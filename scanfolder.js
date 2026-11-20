// This is the script so you don't forget how to do it later cause you forgot
//
//                 first step is delete existing list.js file
//          node "C:\Users\mattc\OneDrive\Desktop\New folder (2)\scanfolder.js"
//               ^^type that into command prompt and it should work
//
//  Another option that is easier is to run the script in addphotos.js which will also create the list.js file for you
//      add photos both to the gallery and to the ImageKit online archive
//      node addphotos.js 2026
//      ^^^this will do it all, change year depending on which gallery you want


const fs = require('fs');
const path = require('path');

// 👇 Set the folder to scan (adjust as needed)
const folderToScan = path.join(__dirname, 'images/screening');

// 👇 Set the output file path
const outputFile = path.join(__dirname, 'list.js');

// Scan the folder
fs.readdir(folderToScan, (err, files) => {
    if (err) {
        console.error('Error reading folder:', err);
        return;
    }

    // Filter only files (optional)
    const fileList = files.filter(file => fs.statSync(path.join(folderToScan, file)).isFile());

    // Generate JS output
    const jsContent = `// Auto-generated file\nexport const FILE_LIST = [\n  ${fileList.map(f => `"${f}"`).join(',\n  ')}\n];\n`;

    // Write to file-list.js
    fs.writeFileSync(outputFile, jsContent);
    console.log(`✅ list.js created with ${fileList.length} files.`);
    
});

