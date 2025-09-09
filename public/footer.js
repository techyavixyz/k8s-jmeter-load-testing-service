// Footer functionality and system stats
function updateSystemStats() {
  const startTime = Date.now();
  
  function updateUptime() {
    const now = Date.now();
    const uptime = now - startTime;
    const hours = Math.floor(uptime / (1000 * 60 * 60));
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((uptime % (1000 * 60)) / 1000);
    
    document.getElementById('uptime').textContent = `${hours}h ${minutes}m ${seconds}s`;
  }
  
  function updateLastUpdate() {
    const now = new Date();
    document.getElementById('lastUpdate').textContent = now.toLocaleTimeString();
  }
  
  // Update immediately
  updateUptime();
  updateLastUpdate();
  
  // Update every second
  setInterval(updateUptime, 1000);
  setInterval(updateLastUpdate, 2000);
}

// Smooth scrolling for footer links
document.addEventListener('DOMContentLoaded', function() {
  updateSystemStats();
  
  // Add smooth scrolling to footer links
  const footerLinks = document.querySelectorAll('.footer-section a[href^="#"]');
  footerLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
});

// Add intersection observer for nav link highlighting
document.addEventListener('DOMContentLoaded', function() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Remove active class from all nav links
        navLinks.forEach(link => link.classList.remove('active'));
        
        // Add active class to corresponding nav link
        const activeLink = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
        if (activeLink) {
          activeLink.classList.add('active');
        }
      }
    });
  }, {
    threshold: 0.3,
    rootMargin: '-80px 0px -80px 0px'
  });
  
  sections.forEach(section => {
    observer.observe(section);
  });
});