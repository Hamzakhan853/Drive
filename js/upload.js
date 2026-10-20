const dropArea = document.getElementById("dropArea");

const fileInput = document.getElementById("fileInput");

const browseBtn = document.getElementById("browseBtn");

const fileList = document.getElementById("fileList");

browseBtn.onclick = () => {
  fileInput.click();
};

fileInput.onchange = () => {
  showFiles(fileInput.files);
};

dropArea.addEventListener("dragover", (e) => {
  e.preventDefault();

  dropArea.style.background = "#e8f0fe";
});

dropArea.addEventListener("dragleave", () => {
  dropArea.style.background = "white";
});

dropArea.addEventListener("drop", (e) => {
  e.preventDefault();

  let files = e.dataTransfer.files;

  showFiles(files);
});

function showFiles(files) {
  fileList.innerHTML = "";

  Array.from(files).forEach((file) => {
    let item = document.createElement("div");

    item.className = "file-item";

    item.innerHTML = `

<div class="file-info">

<span class="material-symbols-outlined file-icon">
description
</span>


<div>

<b>${file.name}</b>

<br>

<small>
${(file.size / 1024).toFixed(2)} KB
</small>

</div>


</div>



<div class="progress-bar">

<div></div>

</div>

`;

    fileList.appendChild(item);
  });
}
