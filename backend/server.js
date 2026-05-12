const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

app.post('/run', async (req, res) => {
    const { code, input } = req.body;
    if (!code) {
        return res.status(400).json({ error: 'No code provided' });
    }

    const runId = Date.now().toString();
    const workDir = path.join('/tmp', `run_${runId}`);
    const codeFile = path.join(workDir, 'main.cpp');
    const inputFile = path.join(workDir, 'input.txt');
    const exeFile = path.join(workDir, 'prog');
    const traceFile = path.join(workDir, 'trace.json');

    try {
        fs.mkdirSync(workDir, { recursive: true });
        fs.writeFileSync(codeFile, code);
        fs.writeFileSync(inputFile, input || '');

        // Compile
        exec(`g++ -g -O0 -std=c++20 ${codeFile} -o ${exeFile}`, (compileError, stdout, stderr) => {
            if (compileError) {
                return res.json({
                    type: 'error',
                    data: `Compilation Error:\n${stderr}`
                });
            }

            // Run GDB with python script
            const gdbProcess = spawn('gdb', [
                '-q',
                '--batch',
                '-x', '/app/tracer.py',
                exeFile
            ]);

            let gdbOut = '';
            gdbProcess.stdout.on('data', data => gdbOut += data);
            gdbProcess.stderr.on('data', data => gdbOut += data);

            gdbProcess.on('close', (code) => {
                try {
                    if (fs.existsSync(traceFile)) {
                        const traceData = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
                        res.json({ type: 'trace', data: traceData });
                    } else {
                        res.json({ type: 'error', data: `GDB Execution Failed:\n${gdbOut}` });
                    }
                } catch (e) {
                    res.json({ type: 'error', data: `JSON Parse Error: ${e.message}\nGDB Output: ${gdbOut}` });
                }

                // Cleanup
                fs.rmSync(workDir, { recursive: true, force: true });
            });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
