function openJmxModal() {
    document.getElementById("jmxModal").style.display = "flex";
    loadJmx();
  }
  
  function closeJmxModal() {
    document.getElementById("jmxModal").style.display = "none";
  }
  
  // Load JMX
  async function loadJmx() {
    console.log("📂 loadJmx() clicked");
    try {
      const res = await fetch("/api/jmx");
      const data = await res.json();
      document.getElementById("jmxEditor").value = data.content || "";
      document.getElementById("jmxStatus").innerText = "✅ JMX loaded";
    } catch (err) {
      console.error("loadJmx() error:", err);
      document.getElementById("jmxStatus").innerText = "❌ Failed to load JMX";
    }
  }
  
  // Save JMX
  async function saveJmx() {
    console.log("💾 saveJmx() clicked");
    const content = document.getElementById("jmxEditor").value;
    try {
      const res = await fetch("/api/jmx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });
      const data = await res.json();
      if (data.status === "saved") {
        alert("✅ JMX file saved successfully!");
        closeJmxModal();
      } else {
        alert("❌ Save failed");
      }
    } catch (err) {
      console.error("saveJmx() error:", err);
      alert("❌ Save failed");
    }
  }
  