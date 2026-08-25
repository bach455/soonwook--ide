import * as vscode from 'vscode';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

let server: http.Server | null = null;

export function activate(context: vscode.ExtensionContext) {

    // 1. 순욱 IDE 전용 패널(Webview)을 열어주는 명령 등록
    let disposable = vscode.commands.registerCommand('soonwook-ide.start', () => {
        
        const panel = vscode.window.createWebviewPanel(
            'soonwookPanel',
            '순욱 AI IDE',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const streamlitUrl = "http://localhost:8501";

        panel.webview.html = `
            <!DOCTYPE html>
            <html lang="ko">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>순욱 AI IDE</title>
                <style>
                    html, body {
                        margin: 0;
                        padding: 0;
                        width: 100%;
                        height: 100%;
                        overflow: hidden;
                        background-color: #1e1e1e;
                    }
                    iframe {
                        width: 100%;
                        height: 100%;
                        border: none;
                    }
                </style>
            </head>
            <body>
                <iframe src="${streamlitUrl}"></iframe>
            </body>
            </html>
        `;
    });

    context.subscriptions.push(disposable);

    // 2. 순욱 웹 UI ↔ VS Code 간 로컬 통신 API 서버 (포트 8502)
    startApiServer();
}

function startApiServer() {
    if (server) return;

    server = http.createServer((req, res) => {
        // CORS 허용 (Streamlit 웹 UI에서 호출 가능하도록)
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        // [API 1] 파일 교체/생성 요청 받기 (/api/apply-code)
        if (req.method === 'POST' && req.url === '/api/apply-code') {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', async () => {
                try {
                    const { filePath, code } = JSON.parse(body);

                    if (!filePath || code === undefined) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: 'Invalid payload' }));
                        return;
                    }

                    // 파일 쓰기
                    fs.writeFileSync(filePath, code, 'utf-8');

                    // VS Code 에디터에서 해당 파일 열어주기
                    const doc = await vscode.workspace.openTextDocument(filePath);
                    await vscode.window.showTextDocument(doc);

                    vscode.window.showInformationMessage(`[순욱 AI] ${path.basename(filePath)} 파일에 코드가 반영되었습니다!`);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (err: any) {
                    vscode.window.showErrorMessage(`[순욱 AI] 코드 반영 실패: ${err.message}`);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: err.message }));
                }
            });
        }
        // [API 2] 특정 라인으로 이동 요청 받기 (/api/goto-line)
        else if (req.method === 'POST' && req.url === '/api/goto-line') {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', async () => {
                try {
                    const { filePath, line } = JSON.parse(body);
                    const doc = await vscode.workspace.openTextDocument(filePath);
                    const editor = await vscode.window.showTextDocument(doc);
                    
                    const lineNum = Math.max(0, line - 1);
                    const pos = new vscode.Position(lineNum, 0);
                    editor.selection = new vscode.Selection(pos, pos);
                    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (err: any) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: err.message }));
                }
            });
        } else {
            res.writeHead(404);
            res.end();
        }
    });

    server.listen(8502, () => {
        console.log('순욱 VS Code API Server running on port 8502');
    });
}

export function deactivate() {
    if (server) {
        server.close();
    }
}