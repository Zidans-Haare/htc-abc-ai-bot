import { fetchAndParse } from './utils.js';

const exportBtn = document.getElementById('btn-export');
const exportModal = document.getElementById('export-modal');
const exportJsonBtn = document.getElementById('export-json');
const exportPdfBtn = document.getElementById('export-pdf');
const exportCancelBtn = document.getElementById('export-cancel');

async function handleExport(type) {
  exportModal.classList.add('hidden');
  try {
    console.log('Exporting data...', type);
    const data = await fetchAndParse('/api/admin/export');
    if (type === 'pdf') {
      if (!window.jspdf) {
        alert('PDF Export nicht verfügbar');
        return;
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const text = JSON.stringify(data, null, 2);
      const lines = doc.splitTextToSize(text, 180);
      doc.text(lines, 10, 10);
      doc.save('export.pdf');
    } else {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'export.json';
      a.click();
      URL.revokeObjectURL(url);
    }
    const stats = await fetchAndParse('/api/admin/stats');
    alert('Gesamt: ' + stats.total);
  } catch (err) {
    console.error('Export error:', err);
  }
}

function initExport() {
    exportBtn.addEventListener('click', () => {
        exportModal.classList.remove('hidden');
    });

    exportCancelBtn.addEventListener('click', () => {
        exportModal.classList.add('hidden');
    });

    exportJsonBtn.addEventListener('click', () => handleExport('json'));
    exportPdfBtn.addEventListener('click', () => handleExport('pdf'));
}

export { initExport };
