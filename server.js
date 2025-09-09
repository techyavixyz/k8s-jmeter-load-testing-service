import express from "express";
import { spawn, exec } from "child_process";
import bodyParser from "body-parser";

const app = express();
const PORT = 4000;

app.use(express.static("public"));
app.use(bodyParser.json({ limit: "10mb" }));

const MASTER_IP = "164.52.211.192";
const JMETER_PATH = "/root/jmeter";
const JMETER_TEST = "gabiru.jmx";
const JMETER_SLAVES = ["164.52.212.41", "164.52.212.42"];
let NAMESPACE = "prod";
let LABEL_SELECTOR = "app=imgproxy-imgproxy";

let clients = [];
let lastReportPath = "";

// ---- SSE logs ----
app.get("/api/logs", (req, res) => {
  console.log("📡 /api/logs connected");
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  clients.push(res);
  req.on("close", () => {
    console.log("❌ SSE client disconnected");
    clients = clients.filter(c => c !== res);
  });
});

function broadcastLog(message) {
  console.log("📢 broadcastLog:", message.trim());
  clients.forEach(res => res.write(`data: ${message}\n\n`));
}

// ---- Check Slaves ----
function checkSlaves(callback) {
  console.log("🔍 Checking slave status...");
  let results = [];
  let pending = JMETER_SLAVES.length;

  JMETER_SLAVES.forEach(ip => {
    const cmd = "pgrep -f jmeter-server >/dev/null && echo RUNNING || echo STOPPED";
    console.log(`➡ ssh root@${ip} "${cmd}"`);
    const ssh = spawn("ssh", [`root@${ip}`, cmd]);

    let status = "STOPPED";
    ssh.stdout.on("data", (data) => {
      status = data.toString().trim();
    });

    ssh.stderr.on("data", (data) => {
      console.error(`SSH error for ${ip}:`, data.toString());
    });

    ssh.on("close", (code) => {
      console.log(`SSH to ${ip} exited with code ${code}`);
      results.push({ ip, status });
      if (--pending === 0) {
        console.log("✅ Slave check results:", results);
        callback(results);
      }
    });
  });
}

// ---- Start Slaves ----
app.get("/api/start-slaves", (req, res) => {
  console.log("▶ /api/start-slaves called");
  JMETER_SLAVES.forEach(ip => {
    const cmd = `cd ${JMETER_PATH}/bin && nohup ./jmeter-server > /root/jmeter/jmeter-server-${ip}.log 2>&1 &`;
    console.log(`🚀 Starting slave ${ip}: ${cmd}`);
    const ssh = spawn("ssh", [`root@${ip}`, cmd]);
    
    ssh.stderr.on("data", (data) => {
      console.error(`Start slave error for ${ip}:`, data.toString());
    });
    
    ssh.on("close", (code) => {
      broadcastLog(`✅ Slave ${ip} jmeter-server started (exit ${code})`);
    });
  });
  res.json({ status: "started", message: "Slaves starting in background…" });
});

// ---- Stop Slaves ----
app.get("/api/stop-slaves", (req, res) => {
  console.log("🛑 /api/stop-slaves called");
  JMETER_SLAVES.forEach(ip => {
    const cmd = `pkill -f jmeter-server || true`;
    console.log(`🛑 Stopping slave ${ip}: ${cmd}`);
    const ssh = spawn("ssh", [`root@${ip}`, cmd]);
    
    ssh.stderr.on("data", (data) => {
      console.error(`Stop slave error for ${ip}:`, data.toString());
    });
    
    ssh.on("close", (code) => {
      broadcastLog(`🛑 Slave ${ip} jmeter-server stopped (exit ${code})`);
    });
  });
  res.json({ status: "stopping", message: "Stopping slaves…" });
});

// ---- Slave Status ----
app.get("/api/slave-status", (req, res) => {
  console.log("🔍 /api/slave-status called");
  checkSlaves((results) => res.json(results));
});

// ---- Run JMeter Test ----
function runJmeterTest(res) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  lastReportPath = `/reports/report-${ts}`;
  const cmd = `cd ${JMETER_PATH} && ./bin/jmeter -n -t ${JMETER_TEST} -R ${JMETER_SLAVES.join(",")} -l results/result-${ts}.jtl -e -o reports/report-${ts}`;

  console.log("▶ Running JMeter test:");
  console.log(`ssh root@${MASTER_IP} "${cmd}"`);

  const ssh = spawn("ssh", [`root@${MASTER_IP}`, cmd]);
  ssh.stdout.on("data", (data) => broadcastLog(data.toString()));
  ssh.stderr.on("data", (data) => broadcastLog("ERR: " + data.toString()));
  ssh.on("close", (code) => {
    if (code === 0) {
      broadcastLog(`✅ JMeter finished with exit code ${code}`);
      broadcastLog(`REPORT_LINK::${lastReportPath}`);
    } else {
      broadcastLog(`❌ JMeter exited with code ${code}`);
    }
  });

  res.json({ status: "started", message: "JMeter test started, logs streaming…" });
}

// ---- Start Test with Auto-Start Slaves ----
app.get("/api/start-test", (req, res) => {
  console.log("▶ /api/start-test called");
  checkSlaves((statuses) => {
    const stopped = statuses.filter(s => s.status !== "RUNNING");
    if (stopped.length > 0) {
      stopped.forEach(s => {
        const cmd = `cd ${JMETER_PATH}/bin && nohup ./jmeter-server > /root/jmeter/jmeter-server-${s.ip}.log 2>&1 &`;
        console.log(`⚡ Auto-starting slave ${s.ip}: ${cmd}`);
        const ssh = spawn("ssh", [`root@${s.ip}`, cmd]);
        
        ssh.stderr.on("data", (data) => {
          console.error(`Auto-start error for ${s.ip}:`, data.toString());
        });
      });
      broadcastLog(`⚡ Auto-started ${stopped.length} stopped slaves...`);
      setTimeout(() => runJmeterTest(res), 5000);
    } else {
      runJmeterTest(res);
    }
  });
});

// ---- HPA Management ----
app.get("/api/hpa", (req, res) => {
  console.log("📡 /api/hpa GET called");
  exec(`kubectl get hpa -n ${NAMESPACE} -o json`, (err, stdout, stderr) => {
    if (err) {
      console.error("❌ kubectl get hpa error:", stderr.toString());
      return res.status(500).json({ error: stderr.toString() });
    }
    const hpas = JSON.parse(stdout).items.map(h => ({
      name: h.metadata.name,
      minReplicas: h.spec.minReplicas,
      maxReplicas: h.spec.maxReplicas,
      currentReplicas: h.status.currentReplicas || 0,
      desiredReplicas: h.status.desiredReplicas || 0,
    }));
    res.json(hpas);
  });
});

app.post("/api/hpa", (req, res) => {
  const { name, minReplicas, maxReplicas } = req.body;
  if (!name) return res.status(400).json({ error: "HPA name required" });

  console.log(`⚙️ Updating HPA ${name}: min=${minReplicas}, max=${maxReplicas}`);
  const cmd = `kubectl patch hpa ${name} -n ${NAMESPACE} -p '{"spec":{"minReplicas":${minReplicas},"maxReplicas":${maxReplicas}}}'`;

  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error("❌ kubectl patch hpa error:", stderr.toString());
      return res.status(500).json({ error: stderr.toString() });
    }
    res.json({ status: "updated", output: stdout });
  });
});

// ---- Pod Metrics ----
app.get("/api/metrics", (req, res) => {
  console.log("📡 /api/metrics called");
  exec(`kubectl get pods -n ${NAMESPACE} --selector=${LABEL_SELECTOR} -o json`, (err, stdout, stderr) => {
    if (err) {
      console.error("❌ kubectl get pods error:", stderr.toString());
      // Continue with empty pods list instead of failing completely
      const resources = {};
      exec(`kubectl top pods -n ${NAMESPACE} --selector=${LABEL_SELECTOR} --no-headers`, (err2, stdout2, stderr2) => {
        if (err2) {
          console.error("❌ kubectl top pods error:", stderr2.toString());
          return res.status(500).json({ error: stderr2.toString() });
        }
        
        stdout2.trim().split("\n").forEach(line => {
          const [name, cpu, mem] = line.split(/\s+/);
          resources[name] = { cpu, mem };
        });
        
        const results = Object.keys(resources).map(name => ({
          name,
          cpu: resources[name]?.cpu || "0m",
          mem: resources[name]?.mem || "0Mi"
        }));
        
        console.log("✅ /api/metrics result:", results);
        res.json(results);
      });
      return;
    }
    
    const pods = JSON.parse(stdout).items.map(p => p.metadata.name);
    exec(`kubectl top pods -n ${NAMESPACE} --selector=${LABEL_SELECTOR} --no-headers`, (err2, stdout2, stderr2) => {
      if (err2) {
        console.error("❌ kubectl top pods error:", stderr2.toString());
        return res.status(500).json({ error: stderr2.toString() });
      }
      
      const resources = {};
      stdout2.trim().split("\n").forEach(line => {
        const [name, cpu, mem] = line.split(/\s+/);
        resources[name] = { cpu, mem };
      });
      
      const results = pods.map(name => ({
        name,
        cpu: resources[name]?.cpu || "0m",
        mem: resources[name]?.mem || "0Mi"
      }));
      
      console.log("✅ /api/metrics result:", results);
      res.json(results);
    });
  });
});

// ---- Node Metrics ----
app.get("/api/nodes", (req, res) => {
  console.log("📡 /api/nodes called");
  exec(`kubectl top nodes --no-headers`, (err, stdout, stderr) => {
    if (err) {
      console.error("❌ kubectl top nodes error:", stderr.toString());
      return res.status(500).json({ error: stderr.toString() });
    }
    const results = stdout.trim().split("\n").map(line => {
      const [name, cpu, cpuPerc, mem, memPerc] = line.split(/\s+/);
      return { name, cpu, cpuPerc, mem, memPerc };
    });
    console.log("✅ /api/nodes result:", results);
    res.json(results);
  });
});

// ---- JMX Management ----
app.get("/api/jmx", (req, res) => {
  console.log("📡 /api/jmx GET called");
  const cmd = `cat ${JMETER_PATH}/${JMETER_TEST}`;
  const ssh = spawn("ssh", [`root@${MASTER_IP}`, cmd]);

  let output = "";
  ssh.stdout.on("data", data => (output += data.toString()));
  ssh.stderr.on("data", data => console.error("ERR:", data.toString()));

  ssh.on("close", code => {
    if (code === 0) {
      res.json({ content: output });
    } else {
      res.status(500).json({ error: `Failed to fetch JMX file (exit ${code})` });
    }
  });
});

app.post("/api/jmx", (req, res) => {
  console.log("📡 /api/jmx POST called");
  const content = req.body.content;
  if (!content) return res.status(400).json({ error: "Missing JMX content" });

  const ssh = spawn("ssh", [`root@${MASTER_IP}`, `tee ${JMETER_PATH}/${JMETER_TEST}`]);
  ssh.stdin.write(content);
  ssh.stdin.end();

  ssh.stderr.on("data", data => console.error("SSH error:", data.toString()));

  ssh.on("close", code => {
    if (code === 0) {
      res.json({ status: "saved" });
    } else {
      res.status(500).json({ error: `Failed to save JMX file (exit ${code})` });
    }
  });
});

// ---- Label Selector Management ----
app.get("/api/label-selector", (req, res) => {
  res.json({ selector: LABEL_SELECTOR, namespace: NAMESPACE });
});

app.post("/api/label-selector", (req, res) => {
  const { selector } = req.body;
  if (!selector) return res.status(400).json({ error: "Label selector required" });

  console.log(`🏷️ Updating label selector to: ${selector}`);
  LABEL_SELECTOR = selector;
  res.json({ status: "updated", selector: LABEL_SELECTOR });
});

// ---- Namespace Management ----
app.get("/api/namespace", (req, res) => {
  res.json({ namespace: NAMESPACE });
});

app.post("/api/namespace", (req, res) => {
  const { namespace } = req.body;
  if (!namespace) return res.status(400).json({ error: "Namespace required" });

  console.log(`🏷️ Updating namespace to: ${namespace}`);
  NAMESPACE = namespace;
  res.json({ status: "updated", namespace: NAMESPACE });
});

// ---- Available Labels ----
app.get("/api/available-labels", (req, res) => {
  console.log("📡 /api/available-labels called");
  exec(`kubectl get pods -n ${NAMESPACE} --show-labels -o json`, (err, stdout, stderr) => {
    if (err) {
      console.error("❌ kubectl get pods with labels error:", stderr.toString());
      return res.status(500).json({ error: stderr.toString() });
    }
    
    const pods = JSON.parse(stdout).items;
    const labelSet = new Set();
    
    pods.forEach(pod => {
      const labels = pod.metadata.labels || {};
      Object.entries(labels).forEach(([key, value]) => {
        labelSet.add(`${key}=${value}`);
      });
    });
    
    const availableLabels = Array.from(labelSet).sort();
    console.log("✅ Available labels:", availableLabels);
    res.json({ labels: availableLabels });
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Dashboard running at http://localhost:${PORT}`);
});