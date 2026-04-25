const fs = require('fs');
let c = fs.readFileSync('server.js', 'utf8');

const routeMarker = "// استيراد الرواتب من ملف Excel (النسخة المتقدمة)";
const listenMarker = "app.listen(PORT,";

const routeIndex = c.indexOf(routeMarker);
const listenIndex = c.indexOf(listenMarker);

if (routeIndex !== -1 && listenIndex !== -1 && routeIndex > listenIndex) {
    // Cut the route
    const routePart = c.substring(routeIndex);
    const mainPart = c.substring(0, routeIndex);
    
    // Put route BEFORE listen
    const final = mainPart.substring(0, listenIndex) + routePart + "\n" + mainPart.substring(listenIndex);
    fs.writeFileSync('server.js', final);
    console.log('✅ server.js: Moved import route BEFORE app.listen');
} else {
    console.log('❌ No movement needed or markers not found');
}
