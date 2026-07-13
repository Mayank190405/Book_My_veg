"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const imageScan_1 = require("../middleware/imageScan");
const testCases = [
    {
        name: "Valid PNG File",
        buffer: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x00]),
        ext: ".png",
        expectedMagic: true,
        expectedScan: true
    },
    {
        name: "Valid JPEG File",
        buffer: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00]),
        ext: ".jpeg",
        expectedMagic: true,
        expectedScan: true
    },
    {
        name: "Valid WebP File",
        buffer: Buffer.concat([
            Buffer.from([0x52, 0x49, 0x46, 0x46]), // "RIFF"
            Buffer.from([0x00, 0x00, 0x00, 0x00]), // chunk size
            Buffer.from("WEBP") // "WEBP"
        ]),
        ext: ".webp",
        expectedMagic: true,
        expectedScan: true
    },
    {
        name: "Invalid magic bytes (Spoofed TXT as PNG)",
        buffer: Buffer.from("Hello World, this is a plain text file!"),
        ext: ".png",
        expectedMagic: false,
        expectedScan: true
    },
    {
        name: "PHP Script Injection threat in PNG",
        buffer: Buffer.concat([
            Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), // PNG header
            Buffer.from("<?php phpinfo(); ?>") // Malicious PHP shell
        ]),
        ext: ".png",
        expectedMagic: true,
        expectedScan: false
    },
    {
        name: "HTML/JS Script Tag threat in JPEG",
        buffer: Buffer.concat([
            Buffer.from([0xFF, 0xD8, 0xFF]),
            Buffer.from("<script>alert('XSS')</script>")
        ]),
        ext: ".jpg",
        expectedMagic: true,
        expectedScan: false
    },
    {
        name: "Inline JS Event threat in WebP",
        buffer: Buffer.concat([
            Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]),
            Buffer.from("some content onload=alert(1) other content")
        ]),
        ext: ".webp",
        expectedMagic: true,
        expectedScan: false
    }
];
function runSuite() {
    console.log("==========================================");
    console.log("RUNNING FRONTEND & BACKEND IMAGE THREAT SCANNER UNIT TESTS");
    console.log("==========================================\n");
    let total = 0;
    let passed = 0;
    for (const tc of testCases) {
        total++;
        console.log(`[Test ${total}] Running: "${tc.name}"`);
        const magicOk = (0, imageScan_1.validateMagicBytes)(tc.buffer, tc.ext);
        const scanOk = (0, imageScan_1.scanForThreats)(tc.buffer).safe;
        const magicPass = magicOk === tc.expectedMagic;
        const scanPass = scanOk === tc.expectedScan;
        if (magicPass && scanPass) {
            passed++;
            console.log(`  => ✅ PASSED`);
            console.log(`     (Magic Bytes Check: ${magicOk ? "VALID" : "INVALID"} | Threat Scan: ${scanOk ? "CLEAN" : "BLOCKED"})`);
        }
        else {
            console.error(`  => ❌ FAILED`);
            console.error(`     Expected Magic: ${tc.expectedMagic}, Got: ${magicOk}`);
            console.error(`     Expected Scan: ${tc.expectedScan}, Got: ${scanOk}`);
        }
        console.log();
    }
    console.log("==========================================");
    console.log(`Suite Complete: ${passed}/${total} test cases PASSED.`);
    console.log("==========================================");
    if (passed === total) {
        process.exit(0);
    }
    else {
        process.exit(1);
    }
}
runSuite();
