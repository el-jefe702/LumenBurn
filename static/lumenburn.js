const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const convertBtn = document.getElementById('convertBtn');
const statusDiv = document.getElementById('status');

let currentFile = null;

dropzone.addEventListener('click', () => fileInput.click());

dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
        handleFile(fileInput.files[0]);
    }
});

function handleFile(file) {
    if (!file.name.endsWith('.svg')) {
        statusDiv.innerText = "Error: Please upload a valid SVG file.";
        statusDiv.style.color = "#ff4444";
        convertBtn.disabled = true;
        return;
    }
    currentFile = file;
    statusDiv.innerText = `Selected: ${file.name} (${Math.round(file.size / 1024)} KB)`;
    statusDiv.style.color = "#aaa";
    convertBtn.disabled = false;
}

convertBtn.addEventListener('click', async () => {
    if (!currentFile) return;
    
    convertBtn.disabled = true;
    statusDiv.innerText = "Converting...";
    statusDiv.style.color = "#007bff";

    try {
        const formData = new FormData();
        formData.append('svg', currentFile);

        const response = await fetch('/api/lumenburn/convert', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error(await response.text());

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = currentFile.name.replace('.svg', '.lbrn2');
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        statusDiv.innerText = "Success! File downloaded.";
        statusDiv.style.color = "#00C851";
    } catch (err) {
        statusDiv.innerText = `Error: ${err.message}`;
        statusDiv.style.color = "#ff4444";
    } finally {
        convertBtn.disabled = false;
    }
});
