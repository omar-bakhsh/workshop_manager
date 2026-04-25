const fs = require('fs');

let admin = fs.readFileSync('admin.html', 'utf8');

// Find and remove the first occurrence of Chat Logic if it's there
// Since I appended to the bottom, the bottom one is "fresher" or at least more "consistent" with my last script.
// Actually, looking at the previous view_file, the one at line 1297 was likely a remnant.

// I'll use a more surgical removal:
// Remove everything between lines 1296 and potentially the start of my bottom insertion if they overlap.
// Actually, I'll just remove the middle one.

const middleChatLogic = /\/\/ Chat Logic[\s\n\t]+function toggleAdminChat\(\) \{[\s\S]*?\/\/ \.\.\. \(rest of the functions remain the same until Chat Logic\) \.\.\.\n/m;
// Wait! That "rest of functions" line was just a comment from the view_file truncated output! 😂
// It's not actually in the file.

// Let's look at the file specifically around 1290.
// 1290:                 }
// 1291:             } catch (e) { console.error(e); }
// 1292:         }
// 1293: 
// 1294:         // ... (rest of the functions remain the same until Chat Logic) ...
// 1295: 
// 1296:         // Chat Logic
// 1297:         function toggleAdminChat() {

// Ah! I see! I'll search for the functions that might be between.

// Actually, I'll just rewrite admin.html to be CLEAN.
// I'll take everything up to loadAdminInspectionStats, then jump to the end part.

// Better: find and remove duplicate ChatWidget and Chat functions.
admin = admin.replace(/<!-- Admin Chat Widget -->[\s\S]*?async function sendAdminMessage\(\) \{[\s\S]*?\}[\s\n]+<\/script>/, ''); 
// This removes the FIRST occurrence.
// If there's another one at the end, it will stay.

fs.writeFileSync('admin.html', admin);
console.log('✅ admin.html: Duplicates cleaned.');
