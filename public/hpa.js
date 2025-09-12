async function loadHpaList() {
    console.log("📂 loadHpaList() clicked");
    try {
      const res = await fetch("/api/hpa");
      const hpas = await res.json();
      const select = document.getElementById("hpaSelect");
      select.innerHTML = "";
      hpas.forEach(h => {
        const opt = document.createElement("option");
        opt.value = h.name;
        opt.textContent = `${h.name} (min:${h.minReplicas}, max:${h.maxReplicas}, cur:${h.currentReplicas})`;
        select.appendChild(opt);
      });
      document.getElementById("hpaStatus").innerText = "✅ HPA list loaded";
    } catch (err) {
      console.error("loadHpaList() error:", err);
      document.getElementById("hpaStatus").innerText = "❌ Failed to load HPAs";
    }
  }
  
  
  async function updateHpa() {
    const name = document.getElementById("hpaSelect").value;
    const minReplicas = document.getElementById("minReplicas").value;
    const maxReplicas = document.getElementById("maxReplicas").value;
  
    if (!name) {
      alert("Please select an HPA");
      return;
    }
  
    console.log(`💾 updateHpa() for ${name}: min=${minReplicas}, max=${maxReplicas}`);
    try {
      const res = await fetch("/api/hpa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, minReplicas, maxReplicas })
      });
      const data = await res.json();
      if (data.status === "updated") {
        document.getElementById("hpaStatus").innerText = `✅ HPA ${name} updated`;
        alert(`✅ HPA ${name} updated successfully!`);
      } else {
        document.getElementById("hpaStatus").innerText = "❌ Update failed";
      }
    } catch (err) {
      console.error("updateHpa() error:", err);
      document.getElementById("hpaStatus").innerText = "❌ Update failed";
    }
  }
  