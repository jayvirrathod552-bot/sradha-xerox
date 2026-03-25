document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadSection = document.getElementById('uploadSection');
    const editorSection = document.getElementById('editorSection');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loaderThumb = document.getElementById('loaderThumb');
    const loaderSubText = document.getElementById('loaderSubText');
    const backBtn = document.getElementById('backBtn');
    
    // Canvas Elements
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    
    // Controls
    const colorBtns = document.querySelectorAll('.color-btn:not(.picker-wrapper)');
    const customColorPicker = document.getElementById('customColorPicker');
    const brightnessSlider = document.getElementById('brightnessSlider');
    const contrastSlider = document.getElementById('contrastSlider');
    const briVal = document.getElementById('briVal');
    const conVal = document.getElementById('conVal');
    const downloadBtn = document.getElementById('downloadBtn');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const toggleGridBtn = document.getElementById('toggleGridBtn');
    const gridOverlay = document.getElementById('gridOverlay');
    const toastMsg = document.getElementById('toastMsg');
    const compareBtn = document.getElementById('compareBtn');
    const autoFixBtn = document.getElementById('autoFixBtn');
    const resetBtn = document.getElementById('resetBtn');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const print1Btn = document.getElementById('print1Btn');
    const print8Btn = document.getElementById('print8Btn');
    const print16Btn = document.getElementById('print16Btn');
    const print32Btn = document.getElementById('print32Btn');
    const zoomSlider = document.getElementById('zoomSlider');
    const offXSlider = document.getElementById('offXSlider');
    const offYSlider = document.getElementById('offYSlider');
    const zoomVal = document.getElementById('zoomVal');
    const offXVal = document.getElementById('offXVal');
    const offYVal = document.getElementById('offYVal');
    const cropModal = document.getElementById('cropModal');
    const cropImage = document.getElementById('cropImage');
    const doneCropBtn = document.getElementById('doneCropBtn');
    const cancelCropBtn = document.getElementById('cancelCropBtn');
    const closeCropBtn = document.getElementById('closeCropBtn');
    const shareBtn = document.getElementById('shareBtn');
    const retouchToggle = document.getElementById('retouchToggle');

    // State Variables
    let cropper = null;
    let originalFilename = 'passport_photo.jpg';
    let fgImageObj = new Image(); // The transparent PNG from backend
    let rawOriginalImageObj = new Image(); // For comparison
    let currentBgColor = '#ffffff';
    let isProcessing = false;

    // Load saved API key
    apiKeyInput.value = localStorage.getItem('removebg_key') || 'SvxEvzAZRzaUhTar5eVkWjtP';
    apiKeyInput.addEventListener('input', (e) => {
        localStorage.setItem('removebg_key', e.target.value);
    });

    // Fixed aspect ratio dimensions (35:45 ratio) - high res for rendering logic handled mostly in backend
    // Canvas resolution (higher than CSS display size for sharpness)
    canvas.width = 700;
    canvas.height = 900;

    // ==== Theme Toggle ====
    themeToggleBtn.addEventListener('click', () => {
        const body = document.body;
        if(body.getAttribute('data-theme') === 'light') {
            body.removeAttribute('data-theme');
            themeToggleBtn.innerHTML = "<i class='bx bx-sun'></i>";
        } else {
            body.setAttribute('data-theme', 'light');
            themeToggleBtn.innerHTML = "<i class='bx bx-moon'></i>";
        }
    });

    // ==== Drag & Drop Handlers ====
    dropZone.addEventListener('click', () => fileInput.click());
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
        }
    });

    // ==== File Processing ====
    function handleFile(file) {
        if (!file.type.startsWith('image/')) {
            showToast('Please upload an image file.');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            showToast('File too large. Max 10MB.');
            return;
        }

        originalFilename = file.name.split('.')[0] + '_passport.jpg';
        
        // Load into Crop Modal
        const reader = new FileReader();
        reader.onload = (e) => {
            cropImage.src = e.target.result;
            cropModal.classList.remove('hidden');
            
            if (cropper) cropper.destroy();
            cropper = new Cropper(cropImage, {
                aspectRatio: 35 / 45,
                viewMode: 1,
                dragMode: 'move',
                autoCropArea: 1,
                restore: false,
                guides: true,
                center: true,
                highlight: false,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false,
            });
        };
        reader.readAsDataURL(file);
    }

    doneCropBtn.addEventListener('click', () => {
        if (!cropper) return;
        const croppedCanvas = cropper.getCroppedCanvas({
            width: 700,
            height: 900,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
        });
        const croppedBase64 = croppedCanvas.toDataURL('image/jpeg', 0.9);
        
        cropper.destroy();
        cropper = null;
        cropModal.classList.add('hidden');
        
        processImageClientSide(croppedBase64);
    });

    [cancelCropBtn, closeCropBtn].forEach(btn => {
        btn.addEventListener('click', () => {
            if (cropper) cropper.destroy();
            cropper = null;
            cropModal.classList.add('hidden');
            fileInput.value = '';
        });
    });

    async function processImageClientSide(croppedBase64) {
        setLoadingState(true, "Removing background via API...");
        
        try {
            // Raw original for comparison
            rawOriginalImageObj.src = croppedBase64;
            
            // Background removal
            let finalImageSrc = croppedBase64;
            let apiKey = apiKeyInput.value.trim(); 

            if (apiKey) {
                setLoadingState(true, "Removing background via API...");
                try {
                    const base64Data = croppedBase64.split(',')[1];
                    const byteCharacters = atob(base64Data);
                    const byteArrays = [];
                    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
                        const slice = byteCharacters.slice(offset, offset + 512);
                        const byteNumbers = new Array(slice.length);
                        for (let i = 0; i < slice.length; i++) {
                            byteNumbers[i] = slice.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        byteArrays.push(byteArray);
                    }
                    const blob = new Blob(byteArrays, {type: 'image/png'});
                    
                    const formData = new FormData();
                    formData.append('size', 'auto');
                    formData.append('image_file', blob, 'image.png');
                    
                    const res = await fetch('https://api.remove.bg/v1.0/removebg', {
                        method: 'POST',
                        headers: { 'X-Api-Key': apiKey },
                        body: formData
                    });
                    
                    if (res.ok) {
                        const bgRemovedBlob = await res.blob();
                        finalImageSrc = URL.createObjectURL(bgRemovedBlob);
                        showToast("Background removed successfully!");
                    } else {
                        showToast("Remove.bg failed, using original.");
                    }
                } catch(e) {
                    console.error("Remove bg error:", e);
                    showToast("API Error, using original.");
                }
            } else {
                showToast("Skipped Background Removal (No API Key set).");
            }

            // Enable Setting API Key (Legacy support for console)
            window.setRemoveBgKey = (key) => {
                apiKeyInput.value = key;
                localStorage.setItem('removebg_key', key);
                alert('API Key saved! Re-upload to apply.');
            };

            // Load final image onto canvas
            fgImageObj.onload = () => {
                renderCanvas();
                setLoadingState(false);
                showEditor();
            };
            fgImageObj.src = finalImageSrc;
            
        } catch (err) {
            console.error(err);
            setLoadingState(false);
            showToast("Failed to process image.");
        }
    }

    // ==== Enhancement Controls ====
    autoFixBtn.addEventListener('click', () => {
        brightnessSlider.value = 110;
        contrastSlider.value = 115;
        retouchToggle.checked = true;
        updateSliderDisplays();
        renderCanvas();
        showToast("Auto-enhanced applied!");
    });

    resetBtn.addEventListener('click', () => {
        brightnessSlider.value = 100;
        contrastSlider.value = 100;
        zoomSlider.value = 1.1;
        offXSlider.value = 0;
        offYSlider.value = 0;
        zoomVal.innerText = '1.1x';
        offXVal.innerText = '0';
        offYVal.innerText = '0';
        updateSliderDisplays();
        renderCanvas();
        showToast("Settings reset.");
    });

    function updateSliderDisplays() {
        briVal.innerText = brightnessSlider.value + '%';
        conVal.innerText = contrastSlider.value + '%';
    }

    // ==== Canvas Rendering (Real-time Preview) ====
    function renderCanvas() {
        if (!fgImageObj.src) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 1. Draw Background Date
        ctx.fillStyle = currentBgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 2. Apply Filters and Draw Foreground
        const bri = brightnessSlider.value;
        const con = contrastSlider.value;
        const isRetouch = retouchToggle.checked;
        
        let filterStr = `brightness(${bri}%) contrast(${con}%)`;
        if (isRetouch) {
            // "Face Retouch" logic: Boost saturation and slight warmth/vibrance
            filterStr += ` saturate(125%) sepia(5%)`;
        }
        ctx.filter = filterStr;
        
        // 3. Apply Zoom and Pan
        const zoom = parseFloat(zoomSlider.value);
        const offX = parseFloat(offXSlider.value);
        const offY = parseFloat(offYSlider.value);

        ctx.save();
        ctx.translate(canvas.width / 2 + offX, canvas.height / 2 + offY);
        ctx.scale(zoom, zoom);
        
        // Draw centered
        ctx.drawImage(fgImageObj, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
        ctx.restore();
        
        // Reset filter
        ctx.filter = 'none';
    }

    // ==== Manual Alignment Event Listeners ====
    [zoomSlider, offXSlider, offYSlider].forEach(slider => {
        slider.addEventListener('input', () => {
            zoomVal.innerText = zoomSlider.value + 'x';
            offXVal.innerText = offXSlider.value;
            offYVal.innerText = offYSlider.value;
            renderCanvas();
        });
    });


    // ==== Controls Handlers ====
    colorBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            colorBtns.forEach(b => b.classList.remove('active'));
            const b = e.currentTarget;
            b.classList.add('active');
            currentBgColor = b.getAttribute('data-color');
            renderCanvas();
        });
    });

    customColorPicker.addEventListener('input', (e) => {
        colorBtns.forEach(b => b.classList.remove('active'));
        currentBgColor = e.target.value;
        e.target.parentElement.classList.add('active');
        renderCanvas();
    });

    brightnessSlider.addEventListener('input', (e) => {
        briVal.innerText = e.target.value + '%';
        renderCanvas();
    });

    contrastSlider.addEventListener('input', (e) => {
        conVal.innerText = e.target.value + '%';
        renderCanvas();
    });

    retouchToggle.addEventListener('change', () => {
        renderCanvas();
    });
    
    toggleGridBtn.addEventListener('click', () => {
        gridOverlay.classList.toggle('hidden');
        toggleGridBtn.classList.toggle('active');
    });
    
    compareBtn.addEventListener('mousedown', () => {
        // Show raw original (uncropped) scaled to fit or fill to show difference
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(rawOriginalImageObj, 0, 0, canvas.width, canvas.height);
    });
    compareBtn.addEventListener('mouseup', renderCanvas);
    compareBtn.addEventListener('mouseleave', renderCanvas);

    // ==== Download Action ====
    downloadBtn.addEventListener('click', async () => {
        if (!fgImageObj.src || isProcessing) return;
        isProcessing = true;
        downloadBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Rendering High-Res...";
        
        try {
            // Client-side high res rendering
            const exportCanvas = document.createElement('canvas');
            // 35x45mm at 300dpi is exact 413x531 px. 
            exportCanvas.width = 413;
            exportCanvas.height = 531;
            const eCtx = exportCanvas.getContext('2d');
            
            // Draw background
            eCtx.fillStyle = currentBgColor;
            eCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
            
            // Apply filters
            const bri = brightnessSlider.value;
            const con = contrastSlider.value;
            const isRetouch = retouchToggle.checked;
            const zoom = parseFloat(zoomSlider.value);
            const offX = parseFloat(offXSlider.value) * (exportCanvas.width / canvas.width);
            const offY = parseFloat(offYSlider.value) * (exportCanvas.height / canvas.height);

            let filterStr = `brightness(${bri}%) contrast(${con}%)`;
            if (isRetouch) filterStr += ` saturate(125%) sepia(5%)`;
            eCtx.filter = filterStr;
            
            // Apply transformations
            eCtx.save();
            eCtx.translate(exportCanvas.width / 2 + offX, exportCanvas.height / 2 + offY);
            eCtx.scale(zoom, zoom);
            eCtx.drawImage(fgImageObj, -exportCanvas.width / 2, -exportCanvas.height / 2, exportCanvas.width, exportCanvas.height);
            eCtx.restore();

            
            // Trigger download
            const dataUrl = exportCanvas.toDataURL('image/jpeg', 0.95);
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = originalFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

        } catch (error) {
            console.error(error);
            showToast("Error generating high-res file.");
        } finally {
            isProcessing = false;
            downloadBtn.innerHTML = "<span>Download JPEG</span><i class='bx bxs-cloud-download'></i>";
        }
    });

    // ==== Share Action ====
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            const text = encodeURIComponent("Check out my high-quality passport photo generated with AI Passport Studio! 🚀");
            const waLink = `https://wa.me/?text=${text}`;
            window.open(waLink, '_blank');
        });
    }

    backBtn.addEventListener('click', () => {
        editorSection.classList.add('hidden');
        uploadSection.classList.remove('hidden');
        // Reset inputs
        fileInput.value = '';
    });

    // ==== Utilities ====
    function setLoadingState(isLoading, text) {
        if (isLoading) {
            loaderSubText.innerText = text || "Processing...";
            loadingOverlay.classList.add('active');
        } else {
            loadingOverlay.classList.remove('active');
            setTimeout(() => { loaderThumb.src = ""; }, 400); // clear after fade
        }
    }

    function showEditor() {
        uploadSection.classList.add('hidden');
        editorSection.classList.remove('hidden');
        downloadBtn.innerHTML = "<span>Save High-Res Image</span><i class='bx bxs-download'></i>";
        // trigger render
        renderCanvas();
    }

    // ==== Print Sheet Actions ====
    print1Btn.addEventListener('click', () => {
        // For 1 copy, we just reuse the single high-res download logic
        downloadBtn.click();
    });
    print8Btn.addEventListener('click', () => generateA4Sheet(8));
    print16Btn.addEventListener('click', () => generateA4Sheet(16));
    print32Btn.addEventListener('click', () => generateA4Sheet(32));

    async function generateA4Sheet(count) {
        if (!fgImageObj.src || isProcessing) return;
        isProcessing = true;
        const originalBtnText = count === 8 ? print8Btn.innerText : (count === 16 ? print16Btn.innerText : print32Btn.innerText);
        const targetBtn = count === 8 ? print8Btn : (count === 16 ? print16Btn : print32Btn);
        targetBtn.innerText = "Generating...";
        
        try {
            const a4Canvas = document.createElement('canvas');
            // A4 at 300 DPI
            const a4W = 2480; 
            const a4H = 3508;
            a4Canvas.width = a4W;
            a4Canvas.height = a4H;
            const aCtx = a4Canvas.getContext('2d');
            
            // Background (White paper)
            aCtx.fillStyle = '#ffffff';
            aCtx.fillRect(0, 0, a4W, a4H);
            
            // Passport image at 300 DPI (35x45mm)
            const photoW = 413;
            const photoH = 531;
            
            // Sub-canvas to pre-render the edited photo with current background and filters
            const singlePhotoCanvas = document.createElement('canvas');
            singlePhotoCanvas.width = photoW;
            singlePhotoCanvas.height = photoH;
            const sCtx = singlePhotoCanvas.getContext('2d');
            
            // Draw background
            sCtx.fillStyle = currentBgColor;
            sCtx.fillRect(0, 0, photoW, photoH);
            
            // Apply filters and transformations
            const bri = brightnessSlider.value;
            const con = contrastSlider.value;
            const isRetouch = retouchToggle.checked;
            const zoom = parseFloat(zoomSlider.value);
            const offX = (parseFloat(offXSlider.value) * (photoW / canvas.width));
            const offY = (parseFloat(offYSlider.value) * (photoH / canvas.height));

            let filterStr = `brightness(${bri}%) contrast(${con}%)`;
            if (isRetouch) filterStr += ` saturate(125%) sepia(5%)`;
            sCtx.filter = filterStr;
            
            sCtx.save();
            sCtx.translate(photoW / 2 + offX, photoH / 2 + offY);
            sCtx.scale(zoom, zoom);
            sCtx.drawImage(fgImageObj, -photoW / 2, -photoH / 2, photoW, photoH);
            sCtx.restore();

            
            // Drawing logic
            let cols, rows;
            if (count === 8) { cols = 2; rows = 4; }
            else if (count === 16) { cols = 4; rows = 4; }
            else { cols = 4; rows = 8; } // 32

            const marginX = (a4W - (cols * photoW)) / (cols + 1);
            const marginY = (a4H - (rows * photoH)) / (rows + 1);
            
            let drawn = 0;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (drawn >= count) break;
                    const x = marginX + c * (photoW + marginX);
                    const y = marginY + r * (photoH + marginY);
                    
                    // Draw a thin grey border for cutting guide
                    aCtx.strokeStyle = '#eeeeee';
                    aCtx.strokeRect(x - 1, y - 1, photoW + 2, photoH + 2);
                    
                    aCtx.drawImage(singlePhotoCanvas, x, y);
                    drawn++;
                }
            }
            
            const dataUrl = a4Canvas.toDataURL('image/jpeg', 0.9);
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = `passport_sheet_${count}_copies.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            showToast(`${count} photo sheet ready!`);

        } catch (error) {
            console.error(error);
            showToast("Print generation failed.");
        } finally {
            isProcessing = false;
            targetBtn.innerText = originalBtnText;
        }
    }

    function showToast(msg) {
        toastMsg.innerText = msg;
        toastMsg.classList.add('show');
        setTimeout(() => toastMsg.classList.remove('show'), 4000);
    }
});
