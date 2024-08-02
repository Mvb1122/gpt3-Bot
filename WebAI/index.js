/**
 * Writes text onto an HTML element over time.
 * @param {string} text Text to write on.
 * @param {HTMLElement | string} element Element to write onto or ID.
 * @param {boolean} [append=true] Whether to add to current text.
 * @param {number} [timeout=100] How long to wait in MS between letters.
 * @returns {Promise} Resolves when write on is complete.
 */
function WriteOn(text, element, append = true, timeout = 15) {
    return new Promise(async res => {
        if (typeof element == String)
            element = document.getElementById(element)
    
        let beforeContent = append ? element.innerText : "";
        for (let i = 0; i < text.length; i++) {
            beforeContent += text.charAt(i);
            element.innerText = beforeContent;
            
            // Scroll all the way down.
            element.scrollTo(0, element.scrollHeight)
            await new Promise(r2 => {
                setTimeout(() => {
                    r2();
                }, timeout);
            });
        }
        res();
    })
}

const NodePrefixes = "TR TM TL MR ML BR BM BL";