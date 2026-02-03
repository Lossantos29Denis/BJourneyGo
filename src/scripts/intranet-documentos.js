// Documentos Internos - Script

// Elementos del DOM
const searchInput = document.getElementById('searchInput');
const filterButtons = document.querySelectorAll('.filter-btn');
const documentCategories = document.querySelectorAll('.documents-category');

let currentFilter = 'todos';

// Función para filtrar documentos
function filterDocuments() {
  documentCategories.forEach(category => {
    const categoryFilter = category.getAttribute('data-category');
    
    if (currentFilter === 'todos' || currentFilter === categoryFilter) {
      category.classList.remove('hidden');
    } else {
      category.classList.add('hidden');
    }
  });
}

// Función para buscar documentos
function searchDocuments(query) {
  const searchTerm = query.toLowerCase();
  
  documentCategories.forEach(category => {
    const cards = category.querySelectorAll('.document-card');
    let visibleCards = 0;
    
    cards.forEach(card => {
      const title = card.querySelector('h3').textContent.toLowerCase();
      const description = card.querySelector('p').textContent.toLowerCase();
      
      if (title.includes(searchTerm) || description.includes(searchTerm)) {
        card.style.display = '';
        visibleCards++;
      } else {
        card.style.display = 'none';
      }
    });
    
    // Mostrar/ocultar categoría si tiene documentos visibles
    if (visibleCards === 0) {
      category.style.display = 'none';
    } else {
      category.style.display = '';
    }
  });
}

// Event listeners para filtros
filterButtons.forEach(button => {
  button.addEventListener('click', () => {
    // Remover clase active de todos los botones
    filterButtons.forEach(btn => btn.classList.remove('active'));
    // Agregar clase active al botón clickeado
    button.classList.add('active');
    
    currentFilter = button.getAttribute('data-filter');
    filterDocuments();
  });
});

// Event listener para búsqueda
searchInput?.addEventListener('input', (e) => {
  const query = e.target.value.trim();
  
  if (query === '') {
    // Si no hay búsqueda, mostrar todos según el filtro
    filterDocuments();
  } else {
    // Buscar en todos los documentos
    const allDocuments = document.querySelectorAll('.document-card');
    const searchTerm = query.toLowerCase();
    
    allDocuments.forEach(card => {
      const title = card.querySelector('h3').textContent.toLowerCase();
      const description = card.querySelector('p').textContent.toLowerCase();
      
      if (title.includes(searchTerm) || description.includes(searchTerm)) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
    
    // Mostrar categorías que tengan documentos visibles
    documentCategories.forEach(category => {
      const visibleCards = Array.from(category.querySelectorAll('.document-card'))
        .some(card => card.style.display !== 'none');
      
      if (visibleCards) {
        category.style.display = '';
      } else {
        category.style.display = 'none';
      }
    });
  }
});

// Event listeners para descargar documentos
document.querySelectorAll('.doc-btn').forEach(button => {
  button.addEventListener('click', (e) => {
    const card = e.target.closest('.document-card');
    const title = card.querySelector('h3').textContent;
    
    // Simulación de descarga
    alert(`Descargando: "${title}"\n\nEn una aplicación real, esto descargaría el archivo.`);
  });
});

// Inicializar
filterDocuments();
