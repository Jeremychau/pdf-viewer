            const pagesEl = document.getElementById('pages');
            const { PDFLogic } = window;

            const createHitButton = ({ left, top, width, height, onClick }) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'hit';
                btn.style.left = `${left}px`;
                btn.style.top = `${top}px`;
                btn.style.width = `${width}px`;
                btn.style.height = `${height}px`;

                const handleInteraction = (evt) => {
                    evt.preventDefault();
                    evt.stopPropagation();
                    onClick(evt);
                };

                btn.addEventListener('click', handleInteraction);
                btn.addEventListener('keydown', (evt) => {
                    if (evt.key === 'Enter' || evt.key === ' ') {
                        handleInteraction(evt);
                    }
                });

                return btn;
            };

            const quizGroups = Object.create(null);
            const quizLocked = Object.create(null);

            window.addEventListener('error', (evt) => {
                console.error('window.onerror:', evt.error || evt.message);
            });

            window.addEventListener('unhandledrejection', (evt) => {
                console.error('unhandledrejection:', evt.reason);
            });

            const main = async () => {
                const origin = window.location?.origin !== 'null' ? window.location.origin : '';
                const pdfUrl = `${origin}/pdf/document.pdf`;

                const pdfjsCdnMod = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/+esm');
                const pdfjsLib = pdfjsCdnMod.default || pdfjsCdnMod;
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/build/pdf.worker.mjs';

                const loadingTask = pdfjsLib.getDocument({ url: pdfUrl });
                const pdfDocument = await loadingTask.promise;

                const availableWidth = Math.min(980, window.innerWidth - 64);
                const scaleCap = 2.0;
                const scaleFloor = 0.75;

                for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
                    const page = await pdfDocument.getPage(pageNumber);

                    // 在 page 渲染之後加入這段
page.getOperatorList().then(function(opList) {
    console.log("PDF 底層繪圖指令 (Operator List):", opList);

    // 你可以嘗試在 opList.args 裡面尋找有沒有零碎的字串
    // 但通常會是亂碼 (Glyph IDs) 或者被切得非常碎
});

                    const rawViewport = page.getViewport({ scale: 1 });
                    const scale = Math.max(scaleFloor, Math.min(scaleCap, availableWidth / rawViewport.width));
                    const viewport = page.getViewport({ scale });

                    const pageWrap = document.createElement('div');
                    pageWrap.className = 'page-wrap';

                    // Render the page
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = Math.floor(viewport.width);
                    canvas.height = Math.floor(viewport.height);
                    canvas.style.width = `${canvas.width}px`;
                    canvas.style.height = `${canvas.height}px`;

                    // Create the AnnotationLayer div
                    const annotationLayerDiv = document.createElement('div');
                    annotationLayerDiv.className = 'annotationLayer';
                    annotationLayerDiv.style.width = `${canvas.width}px`;
                    annotationLayerDiv.style.height = `${canvas.height}px`;

                    // Create the overlay
                    const overlay = document.createElement('div');
                    overlay.className = 'overlay';
                    overlay.style.width = `${canvas.width}px`;
                    overlay.style.height = `${canvas.height}px`;

                    pageWrap.append(canvas, annotationLayerDiv, overlay);
                    pagesEl.appendChild(pageWrap);

                    await page.render({ canvasContext: ctx, viewport }).promise;

                    // Get the annotations
                    const annotations = await page.getAnnotations({ intent: 'display' });

                    // Force popups to be renderable by removing hidden flags
                    annotations.forEach(anno => {
                        // We also need to unhide the parent annotations that trigger the popups
                        if (anno.annotationFlags) {
                            anno.annotationFlags &= ~2; // Remove HIDDEN
                            anno.annotationFlags &= ~32; // Remove NOVIEW
                            anno.annotationFlags |= 4; // PRINT
                        }

                        const name = PDFLogic.normalizeStr(anno.fieldName || '');
                        if (name.endsWith('_popup')) {
                            // If it's a TextWidget without a rect, give it a default rect
                            // so AnnotationLayer can render it
                            if (!anno.rect || (anno.rect[2] - anno.rect[0] === 0)) {
                                anno.rect = [0, 0, 100, 100];
                            }
                            
                            // Make sure subtype is something AnnotationLayer renders directly
                            if (anno.subtype === 'Popup') {
                                // Try to convert to Text annotation which has a built-in popup
                                anno.subtype = 'Text';
                                anno.hasPopup = true;
                                anno.title = anno.title || 'Popup';
                                anno.contents = anno.contents || anno.richText || '';
                                
                                // Give it an icon name so it renders
                                if (!anno.name) anno.name = 'Comment';
                                
                                // Remove the popup reference so it doesn't try to find a parent
                                if (anno.popup) {
                                    delete anno.popup;
                                }
                            }
                        }
                    });

                    // Render native AnnotationLayer
                    try {
                        const annotationLayer = new pdfjsLib.AnnotationLayer({
                            page,
                            viewport,
                            div: annotationLayerDiv,
                        });
                        await annotationLayer.render({
                            annotations,
                            page,
                            viewport,
                            div: annotationLayerDiv,
                            renderForms: true,
                            linkService: {
                                getDestinationHash: () => '',
                                getAnchorUrl: () => '',
                                setHash: () => {},
                                executeNamedAction: () => {},
                                cachePageRef: () => {},
                                isPageVisible: () => true,
                                isPageCached: () => true,
                                pdfDocument: pdfDocument,
                            }
                        });
                        
                        // Force all elements in annotation layer to be visible initially
                        // so we can find them, then hide the ones that should be hidden
                        const allNativeAnnos = annotationLayerDiv.querySelectorAll('.annotationLayer section');
                        allNativeAnnos.forEach(el => {
                            el.style.visibility = 'visible';
                            el.style.display = 'block';
                            
                            // Try to trigger click to open popups if they are hidden
                            const img = el.querySelector('img');
                            if (img) {
                                // Add a small delay to let DOM settle
                                setTimeout(() => {
                                    img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                                }, 100);
                            }
                        });
                    } catch (e) {
                        console.error('AnnotationLayer render error:', e);
                    }
                    
                    // Remove the aggressive !important CSS that was breaking visibility toggling
                    const style = document.createElement('style');
                    style.textContent = `
                        .annotationLayer .popupWrapper {
                            z-index: 100;
                        }
                    `;
                    document.head.appendChild(style);
                    
                    // 2) Pre-scan for popup targets
                    const popupTargets = {};
                    annotations.forEach(anno => {
                        if (!anno?.rect) return;
                        const name = PDFLogic.normalizeStr(anno.fieldName || '');
                        if (name.endsWith('_popup')) {
                            popupTargets[name] = anno;
                        }
                    });

                    const getNativePopupEl = (targetAnno) => {
                        if (!targetAnno) return null;
                        return annotationLayerDiv.querySelector(`[data-annotation-id="${targetAnno.id}"]`);
                    };

                    const toggleNativePopup = (el, forceShow) => {
                        if (!el) return;
                        if (forceShow === undefined) {
                            forceShow = el.style.visibility === 'hidden' || el.style.display === 'none' || el.style.opacity === '0';
                        }
                        
                        if (forceShow) {
                            el.style.visibility = 'visible';
                            el.style.display = 'block';
                            el.style.opacity = '1';
                            el.style.zIndex = '100';
                            
                            // Also make sure inner popup elements are visible
                            const innerPopup = el.querySelector('.popup');
                            if (innerPopup) {
                                innerPopup.style.display = 'block';
                                innerPopup.style.visibility = 'visible';
                                innerPopup.style.opacity = '1';
                            }
                            
                            const popupWrapper = el.querySelector('.popupWrapper');
                            if (popupWrapper) {
                                popupWrapper.style.display = 'block';
                                popupWrapper.style.visibility = 'visible';
                                popupWrapper.style.opacity = '1';
                            }
                            
                            // Don't simulate click if we are forcing it via CSS, 
                            // it might just toggle it back off!
                        } else {
                            el.style.visibility = 'hidden';
                            el.style.display = 'none';
                            el.style.opacity = '0';
                            
                            const innerPopup = el.querySelector('.popup');
                            if (innerPopup) {
                                innerPopup.style.display = 'none';
                                innerPopup.style.visibility = 'hidden';
                            }
                            
                            const popupWrapper = el.querySelector('.popupWrapper');
                            if (popupWrapper) {
                                popupWrapper.style.display = 'none';
                                popupWrapper.style.visibility = 'hidden';
                            }
                        }
                    };

                    // Create manual popups for the description but style them like native popups
                    // if native popups still refuse to render
                    const popupElements = {};
                    Object.entries(popupTargets).forEach(([name, anno]) => {
                        const rectPx = viewport.convertToViewportRectangle(anno.rect);
                        const [left, top, width, height] = [
                            Math.min(rectPx[0], rectPx[2]),
                            Math.min(rectPx[1], rectPx[3]),
                            Math.abs(rectPx[2] - rectPx[0]),
                            Math.abs(rectPx[3] - rectPx[1])
                        ];

                        const popup = document.createElement('div');
                        popup.className = 'popup native-style';
                        popup.style.left = `${left}px`;
                        popup.style.top = `${top}px`;
                        // If it has a 0x0 rect, give it a default size
                        if (width === 0 || height === 0) {
                            popup.style.minWidth = '250px';
                            popup.style.minHeight = '100px';
                        } else {
                            popup.style.width = `${width}px`;
                            popup.style.height = `${height}px`;
                        }
                        
                        // Try to get rich text first, then fallback to contents
                        let content = anno.richText || anno.contents || anno.fieldValue || anno.value || anno.title || '';
                        
                        // If it's a string that looks like XML/HTML (rich text), we can insert it as HTML
                        if (typeof content === 'string' && (content.includes('<') && content.includes('>'))) {
                            // Basic cleanup of PDF rich text XML
                            content = content.replace(/<\?xml.*?\?>/i, '')
                                           .replace(/<body.*?>/i, '')
                                           .replace(/<\/body>/i, '')
                                           .replace(/xmlns=".*?"/g, '')
                                           .replace(/xfa:APIVersion=".*?"/g, '')
                                           .replace(/xfa:spec=".*?"/g, '')
                                           .replace(/dir=".*?"/g, ''); // Remove dir attributes which can sometimes mess up layout
                            
                            // Convert PDF rich text styling to HTML styling if needed
                            // (Most of it is already valid HTML like <b>, <i>, <p>, <span style="...">)
                            
                            const contentDiv = document.createElement('div');
                            contentDiv.innerHTML = content;
                            
                            // Fix any span tags that have color styles to ensure they are visible
                            const spans = contentDiv.querySelectorAll('span');
                            spans.forEach(span => {
                                if (span.style.color === '#000000' || span.style.color === 'rgb(0, 0, 0)') {
                                    // Leave black alone
                                } else if (span.style.color) {
                                    // Ensure other colors are visible
                                    span.style.fontWeight = 'bold';
                                }
                            });
                            
                            // Make sure paragraphs don't have huge margins
                            const paragraphs = contentDiv.querySelectorAll('p');
                            paragraphs.forEach(p => {
                                p.style.margin = '0 0 8px 0';
                            });
                            
                            // Make sure text is readable (not white on white)
                            contentDiv.style.color = '#333';
                            
                            popup.appendChild(contentDiv);
                        } else {
                            const contentDiv = document.createElement('div');
                            contentDiv.textContent = content;
                            contentDiv.style.color = '#333';
                            popup.appendChild(contentDiv);
                        }
                        
                        // Hide it initially
                        popup.style.display = 'none';
                        
                        // Add close button
                        const closeBtn = document.createElement('button');
                        closeBtn.textContent = '×';
                        closeBtn.className = 'popup-close-btn';
                        closeBtn.onclick = (e) => {
                            e.stopPropagation();
                            popup.classList.remove('open');
                            popup.style.display = 'none';
                            if (openPopupEl === popup) openPopupEl = null;
                        };
                        popup.appendChild(closeBtn);
                        
                        overlay.appendChild(popup);
                        popupElements[name] = popup;
                        
                        // Also try to find and hide the native popup if it exists but is broken
                        setTimeout(() => {
                            const nativeEl = getNativePopupEl(anno);
                            if (nativeEl) {
                                toggleNativePopup(nativeEl, false);
                            }
                        }, 600);
                    });

                    console.log(annotations);

                    // 1) Process Quiz Groups
                    annotations.forEach(anno => {
                        if (!anno?.rect || !PDFLogic.isQuizWidget(anno)) return;

                        const groupKey = PDFLogic.extractGroupKey(anno, pageNumber);
                        if (!quizGroups[groupKey]) {
                            quizGroups[groupKey] = {
                                fieldValue: typeof anno.fieldValue === 'string' ? anno.fieldValue : '',
                                options: []
                            };
                        } else if (!quizGroups[groupKey].fieldValue && typeof anno.fieldValue === 'string') {
                            quizGroups[groupKey].fieldValue = anno.fieldValue;
                        }

                        const rectPx = viewport.convertToViewportRectangle(anno.rect);
                        quizGroups[groupKey].options.push({
                            label: PDFLogic.extractWidgetOptionLabel(anno) || groupKey,
                            rect: {
                                left: Math.min(rectPx[0], rectPx[2]),
                                top: Math.min(rectPx[1], rectPx[3]),
                                width: Math.abs(rectPx[2] - rectPx[0]),
                                height: Math.abs(rectPx[3] - rectPx[1])
                            },
                            annotation: anno
                        });
                    });

                    // De-dup quiz options
                    Object.values(quizGroups).forEach(group => {
                        const seen = new Set();
                        group.options = group.options.filter(opt => {
                            const key = PDFLogic.normalizeStr(opt.label);
                            if (!key || seen.has(key)) return false;
                            seen.add(key);
                            return true;
                        });
                    });

                    // 3) Create interactive elements
                    let openPopupEl = null;

                    // Initially hide all popup targets
                    Object.values(popupTargets).forEach(anno => {
                        // We need a slight delay because AnnotationLayer renders asynchronously
                        setTimeout(() => {
                            const el = getNativePopupEl(anno);
                            if (el) toggleNativePopup(el, false);
                        }, 500);
                    });

                    annotations.forEach((anno, i) => {
                        if (!anno?.rect) return;

                        const rectPx = viewport.convertToViewportRectangle(anno.rect);
                        const [left, top, width, height] = [
                            Math.min(rectPx[0], rectPx[2]),
                            Math.min(rectPx[1], rectPx[3]),
                            Math.abs(rectPx[2] - rectPx[0]),
                            Math.abs(rectPx[3] - rectPx[1])
                        ];

                        const type = PDFLogic.getAnnotationType(anno);

                        if (type === 'quiz') {
                            const groupKey = PDFLogic.extractGroupKey(anno, pageNumber);
                            const hit = createHitButton({
                                left, top, width: Math.max(1, width), height: Math.max(1, height),
                                onClick: (evt) => {
                                    const currentGroupKey = evt.currentTarget.dataset.quizGroupKey;
                                    if (quizLocked[currentGroupKey]) return;
                                    quizLocked[currentGroupKey] = true;

                                    const name = PDFLogic.normalizeStr(anno.fieldName || '');
                                    const isCorrect = name.includes('correct') && !name.includes('incorrect');
                                    const targetPopupName = name.replace(/(_btn|_on|_off)$/i, '_popup');
                                    
                                    const targetAnno = popupTargets[targetPopupName];
                                    let badgePos = { left, top, width, height };
                                    if (targetAnno) {
                                        const targetRectPx = viewport.convertToViewportRectangle(targetAnno.rect);
                                        badgePos = {
                                            left: Math.min(targetRectPx[0], targetRectPx[2]),
                                            top: Math.min(targetRectPx[1], targetRectPx[3]),
                                            width: Math.abs(targetRectPx[2] - targetRectPx[0]),
                                            height: Math.abs(targetRectPx[3] - targetRectPx[1])
                                        };
                                    }

                                    const badge = document.createElement('div');
                                    badge.className = `badge ${isCorrect ? 'ok' : 'no'}`;
                                    badge.textContent = isCorrect ? '✓' : '×';
                                    badge.style.left = `${badgePos.left + badgePos.width / 2}px`;
                                    badge.style.top = `${badgePos.top + badgePos.height / 2}px`;
                                    overlay.appendChild(badge);

                                    document.querySelectorAll(`.hit[data-quiz-group-key="${currentGroupKey}"]`).forEach(h => {
                                        h.classList.add('locked');
                                        Object.assign(h.style, { pointerEvents: 'none', background: 'transparent', border: 'none' });
                                    });
                                }
                            });
                            hit.classList.add('type-quiz');
                            hit.dataset.quizGroupKey = groupKey;
                            overlay.appendChild(hit);
                            return;
                        }

                        if (type === 'view-desc') {
                            const name = PDFLogic.normalizeStr(anno.fieldName || '');
                            const targetPopupName = name.replace(/(_btn|_on|_off)$/i, '_popup');
                            const targetAnno = popupTargets[targetPopupName];
                            const manualPopup = popupElements[targetPopupName];

                            const hit = createHitButton({
                                left, top, width: Math.max(1, width), height: Math.max(1, height),
                                onClick: () => {
                                    const targetEl = getNativePopupEl(targetAnno);
                                    
                                    if (openPopupEl && openPopupEl !== targetEl && openPopupEl !== manualPopup) {
                                        if (openPopupEl.classList && openPopupEl.classList.contains('popup')) {
                                            openPopupEl.classList.remove('open');
                                            openPopupEl.style.display = 'none';
                                        } else {
                                            toggleNativePopup(openPopupEl, false);
                                        }
                                    }
                                    
                                    // Use the native AnnotationLayer element
                                    if (targetEl) {
                                        const isHidden = targetEl.style.visibility === 'hidden' || targetEl.style.display === 'none' || targetEl.style.opacity === '0';
                                        
                                        // If it's positioned at 0,0 (default rect), move it near the button
                                        if (targetEl.style.left === '0px' && targetEl.style.top === '0px') {
                                            targetEl.style.left = `${left + width + 10}px`;
                                            targetEl.style.top = `${top}px`;
                                        }
                                        
                                        toggleNativePopup(targetEl, isHidden);
                                        openPopupEl = isHidden ? targetEl : null;
                                        
                                        // Force the target element to be at the top level
                                        if (targetEl && !isHidden) {
                                            targetEl.style.zIndex = '1000';
                                        }
                                    }
                                }
                            });
                            hit.classList.add('type-view-desc');
                            overlay.appendChild(hit);
                            return;
                        }

                        // We don't create custom popups for placeholders or other types anymore.
                        // AnnotationLayer handles rendering them.
                    });

                    pageWrap.addEventListener('click', () => {
                        if (openPopupEl) {
                            if (openPopupEl.classList && openPopupEl.classList.contains('popup')) {
                                openPopupEl.classList.remove('open');
                                openPopupEl.style.display = 'none';
                            } else {
                                toggleNativePopup(openPopupEl, false);
                            }
                            openPopupEl = null;
                        }
                    });
                    overlay.addEventListener('click', (evt) => evt.stopPropagation());
                }
            };

            main().catch(err => {
                console.error(err);
            });
        </script>
