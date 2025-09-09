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
  
// JMX File Upload Functions
function handleJmxFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    uploadJmxFile(file);
  }
}

function handleJmxDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  
  const uploadArea = event.currentTarget;
  uploadArea.classList.remove('dragover');
  
  const files = event.dataTransfer.files;
  if (files.length > 0) {
    const file = files[0];
    if (file.name.endsWith('.jmx')) {
      uploadJmxFile(file);
    } else {
      alert('Please select a valid JMX file');
    }
  }
}

function handleJmxDragOver(event) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.add('dragover');
}

function handleJmxDragLeave(event) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.remove('dragover');
}

async function uploadJmxFile(file) {
  console.log("📤 uploadJmxFile() called with:", file.name);
  
  if (file.size > 10 * 1024 * 1024) { // 10MB limit
    alert('File size must be less than 10MB');
    return;
  }
  
  document.getElementById("jmxUploadStatus").innerText = "🔄 Uploading JMX file...";
  
  try {
    const content = await file.text();
    const filename = file.name.replace('.jmx', ''); // Remove extension, server will add it back
    
    const res = await fetch("/api/jmx/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, content })
    });
    
    const data = await res.json();
    
    if (data.status === "uploaded") {
      document.getElementById("jmxUploadStatus").innerText = `✅ JMX file uploaded successfully: ${data.filename}`;
      alert(`✅ JMX file uploaded successfully: ${data.filename}`);
      
      // Clear the file input
      document.getElementById('jmxFileInput').value = '';
    } else {
      document.getElementById("jmxUploadStatus").innerText = "❌ Upload failed";
      alert("❌ Upload failed");
    }
  } catch (err) {
    console.error("uploadJmxFile() error:", err);
    document.getElementById("jmxUploadStatus").innerText = "❌ Upload failed";
    alert("❌ Upload failed");
  }
}