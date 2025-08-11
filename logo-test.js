// Test-Script für Logo-Wechsel im Browser
// Führe das im Browser-Entwicklertools (F12 -> Console) aus

console.log("=== Logo-Wechsel Test ===");

// Zeige alle gefundenen HTW Logos
const htwLogos = document.querySelectorAll('img[src*="HTW.svg"], img[src*="HTW_hell.png"], img[alt*="HTW"], img[alt*="HTWD"]');
console.log(`Gefundene HTW Logos: ${htwLogos.length}`);
htwLogos.forEach((logo, i) => {
    console.log(`Logo ${i+1}: src="${logo.src}", alt="${logo.alt}"`);
});

// Teste Dark Mode Aktivierung
console.log("\n--- Teste Dark Mode ---");
document.documentElement.classList.add('dark-mode');
console.log("Dark Mode aktiviert");

setTimeout(() => {
    htwLogos.forEach((logo, i) => {
        console.log(`Logo ${i+1} nach Dark Mode: src="${logo.src}"`);
    });
}, 100);

// Teste Light Mode Aktivierung
setTimeout(() => {
    console.log("\n--- Teste Light Mode ---");
    document.documentElement.classList.remove('dark-mode');
    console.log("Light Mode aktiviert");
    
    setTimeout(() => {
        htwLogos.forEach((logo, i) => {
            console.log(`Logo ${i+1} nach Light Mode: src="${logo.src}"`);
        });
    }, 100);
}, 2000);