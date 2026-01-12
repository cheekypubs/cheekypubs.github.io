/**
 * Stories Page JavaScript
 * Handles sidebar toggle for mobile and pagination
 */

document.addEventListener('DOMContentLoaded', function() {
  // Sidebar toggle for mobile
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('storiesSidebar');
  
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', function() {
      sidebar.classList.toggle('active');
      sidebarToggle.classList.toggle('active');
      
      // Update aria-expanded
      const isExpanded = sidebar.classList.contains('active');
      sidebarToggle.setAttribute('aria-expanded', isExpanded);
    });
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function(e) {
      if (window.innerWidth <= 768) {
        if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
          sidebar.classList.remove('active');
          sidebarToggle.classList.remove('active');
          sidebarToggle.setAttribute('aria-expanded', 'false');
        }
      }
    });
  }
  
  // Client-side pagination for stories
  initPagination();
});

function initPagination() {
  const paginationContainer = document.getElementById('storiesPagination');
  const storyList = document.querySelector('.story-list');
  
  if (!paginationContainer || !storyList) return;
  
  const perPage = parseInt(paginationContainer.dataset.perPage) || 20;
  const stories = storyList.querySelectorAll('.story-preview');
  const totalStories = stories.length;
  const totalPages = Math.ceil(totalStories / perPage);
  
  if (totalPages <= 1) return;
  
  let currentPage = 1;
  
  // Get page from URL hash if present
  const hash = window.location.hash;
  if (hash && hash.startsWith('#page-')) {
    const hashPage = parseInt(hash.replace('#page-', ''));
    if (hashPage > 0 && hashPage <= totalPages) {
      currentPage = hashPage;
    }
  }
  
  function showPage(page) {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    
    stories.forEach((story, index) => {
      if (index >= start && index < end) {
        story.style.display = 'block';
      } else {
        story.style.display = 'none';
      }
    });
    
    currentPage = page;
    window.location.hash = `page-${page}`;
    renderPagination();
    
    // Scroll to top of story list
    storyList.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  
  function renderPagination() {
    let html = '<div class="pagination-controls">';
    
    // Previous button
    if (currentPage > 1) {
      html += `<a href="#page-${currentPage - 1}" class="pagination-btn prev" data-page="${currentPage - 1}">&laquo; Prev</a>`;
    } else {
      html += '<span class="pagination-btn prev disabled">&laquo; Prev</span>';
    }
    
    // Page numbers
    html += '<span class="page-numbers">';
    for (let i = 1; i <= totalPages; i++) {
      if (i === currentPage) {
        html += `<span class="page-num current">${i}</span>`;
      } else {
        html += `<a href="#page-${i}" class="page-num" data-page="${i}">${i}</a>`;
      }
    }
    html += '</span>';
    
    // Next button
    if (currentPage < totalPages) {
      html += `<a href="#page-${currentPage + 1}" class="pagination-btn next" data-page="${currentPage + 1}">Next &raquo;</a>`;
    } else {
      html += '<span class="pagination-btn next disabled">Next &raquo;</span>';
    }
    
    html += '</div>';
    
    paginationContainer.innerHTML = html;
    
    // Add click handlers
    paginationContainer.querySelectorAll('[data-page]').forEach(link => {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        const page = parseInt(this.dataset.page);
        showPage(page);
      });
    });
  }
  
  // Initial page load
  showPage(currentPage);
}
