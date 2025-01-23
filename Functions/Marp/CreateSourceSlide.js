/**
 * Creates a Marp slide with sources.
 * @param {[{title: string, text: string, link: string}]} data 
 * @returns {string} Marp slide.
 */
module.exports = function C(data) {
    return `\n\n---\n\n# Sources\n` + data.map((v, i) => {
        return `${i}. ${v.title}: ${v.link}`
    }).join("\n");
}