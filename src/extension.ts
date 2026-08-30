import * as vscode from 'vscode';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

let server: http.Server | null = null;
let statusBarItem: vscode.StatusBarItem | null = null;

export function activate(context: vscode.ExtensionContext) {
    console.log('🛡️ [순욱 IDE] 활성화 시작...');

    // ============ 1️⃣ 상태바 버튼 생성 (최상단 우선순위!) ============
    try {
        statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right, 
            99999  // 최대 우선순위! (제일 왼쪽에 표시)
        );

        statusBarItem.name = "순욱 AI IDE";
        statusBarItem.text = "🛡️ 순욱 AI IDE";
        statusBarItem.tooltip = "클릭: 순욱 AI IDE 실행 | 오른쪽 클릭: 옵션";
        statusBarItem.command = 'soonwook-ide.start';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBar.background');
        statusBarItem.color = new vscode.ThemeColor('statusBar.foreground');

        statusBarItem.show();
        context.subscriptions.push(statusBarItem);

        console.log('✅ [순욱 IDE] 상태바 버튼 생성 완료!');
        console.log('✅ [순욱 IDE] 상태바 위치: 오른쪽, 우선순위: 99999 (최상단)');

    } catch (err) {
        console.error('❌ 상태바 버튼 생성 실패:', err);
        vscode.window.showErrorMessage(`❌ 상태바 버튼 오류: ${err}`);
    }

    // ============ 2️⃣ 순욱 IDE 실행 명령 등록 ============
    let disposable = vscode.commands.registerCommand('soonwook-ide.start', async () => {
        console.log('🛡️ [순욱 IDE] 명령 실행됨');

        try {
            const panel = vscode.window.createWebviewPanel(
                'soonwookPanel',
                '🛡️ 순욱 AI IDE',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: []
                }
            );

            const streamlitUrl = "http://localhost:8501";

            panel.webview.html = `
                <!DOCTYPE html>
                <html lang="ko">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>🛡️ 순욱 AI IDE</title>
                    <style>
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }
                        html, body {
                            width: 100%;
                            height: 100%;
                            overflow: hidden;
                            background-color: #1e1e1e;
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        }
                        .container {
                            width: 100%;
                            height: 100%;
                            display: flex;
                            flex-direction: column;
                        }
                        .toolbar {
                            background: linear-gradient(135deg, #2d2d2d 0%, #1e1e1e 100%);
                            padding: 8px 12px;
                            display: flex;
                            gap: 8px;
                            align-items: center;
                            border-bottom: 2px solid #0078d4;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                        }
                        .toolbar-title {
                            color: #61dafb;
                            font-weight: bold;
                            margin-right: auto;
                            font-size: 14px;
                            letter-spacing: 0.5px;
                        }
                        .toolbar button {
                            background: linear-gradient(135deg, #0078d4 0%, #005a9e 100%);
                            color: white;
                            border: none;
                            padding: 6px 14px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 12px;
                            font-weight: 500;
                            transition: all 0.2s;
                            display: flex;
                            align-items: center;
                            gap: 4px;
                        }
                        .toolbar button:hover {
                            background: linear-gradient(135deg, #005a9e 0%, #003d7a 100%);
                            transform: translateY(-1px);
                            box-shadow: 0 2px 8px rgba(0,120,212,0.3);
                        }
                        .toolbar button:active {
                            transform: translateY(0);
                        }
                        iframe {
                            flex: 1;
                            width: 100%;
                            border: none;
                            background: white;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="toolbar">
                            <span class="toolbar-title">🛡️ 순욱 AI IDE - Streamlit 웹 패널</span>
                            <button onclick="location.reload()">🔄 새로고침</button>
                            <button onclick="openExternal()">🌐 브라우저</button>
                        </div>
                        <iframe src="${streamlitUrl}" id="mainFrame"></iframe>
                    </div>
                    <script>
                        function openExternal() {
                            window.open('${streamlitUrl}', '_blank');
                        }
                    </script>
                </body>
                </html>
            `;

            console.log('✅ [순욱 IDE] 웹뷰 패널 생성 완료');

            panel.onDidDispose(() => {
                console.log('🛡️ [순욱 IDE] 패널 닫힘');
            }, null, context.subscriptions);

        } catch (err) {
            console.error('❌ 패널 생성 실패:', err);
            vscode.window.showErrorMessage(`❌ 순욱 IDE 실행 실패: ${err}`);
        }
    });

    context.subscriptions.push(disposable);

    // ============ 3️⃣ API 서버 시작 ============
    startApiServer(context);

    // ============ 4️⃣ 활성화 완료 ============
    console.log('✅ [순욱 IDE] 모든 초기화 완료!');
    console.log('✅ [순욱 IDE] 상태바 "🛡️ 순욱 AI IDE" 버튼을 찾아보세요!');
}

// ==================== 파일 적용 함수 ====================
async function applyCodeToFile(filePath: string, code: string): Promise<void> {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(filePath, code, 'utf-8');
        await openFileInEditor(filePath);

        console.log(`✅ 파일 적용: ${filePath}`);
        vscode.window.showInformationMessage(`✅ 파일 적용 완료: ${path.basename(filePath)}`);
    } catch (err) {
        console.error('❌ 파일 적용 실패:', err);
        vscode.window.showErrorMessage(`❌ 파일 적용 실패: ${err}`);
    }
}

async function openFileInEditor(filePath: string): Promise<void> {
    try {
        const uri = vscode.Uri.file(filePath);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc);
    } catch (err) {
        console.error('❌ 파일 열기 실패:', err);
        vscode.window.showErrorMessage(`❌ 파일 열기 실패: ${err}`);
    }
}

// ==================== API 서버 ====================
function startApiServer(context: vscode.ExtensionContext) {
    if (server) {
        console.log('ℹ️ API 서버가 이미 실행 중입니다');
        return;
    }

    server = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

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

                    const dir = path.dirname(filePath);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }

                    fs.writeFileSync(filePath, code, 'utf-8');
                    await openFileInEditor(filePath);

                    console.log(`✅ API: 파일 적용 - ${filePath}`);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        success: true, 
                        message: `✅ ${path.basename(filePath)} 적용 완료!` 
                    }));

                    vscode.window.showInformationMessage(
                        `✅ 순욱이 파일을 적용했습니다: ${path.basename(filePath)}`
                    );

                } catch (err) {
                    console.error('❌ API apply-code 오류:', err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: String(err) }));
                }
            });
            return;
        }

        if (req.method === 'POST' && req.url === '/api/read-file') {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', () => {
                try {
                    const { filePath } = JSON.parse(body);

                    if (!fs.existsSync(filePath)) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: '파일 없음' }));
                        return;
                    }

                    const content = fs.readFileSync(filePath, 'utf-8');
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, content }));

                } catch (err) {
                    console.error('❌ API read-file 오류:', err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: String(err) }));
                }
            });
            return;
        }

        if (req.method === 'GET' && req.url === '/api/current-file') {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const filePath = editor.document.fileName;
                const content = editor.document.getText();
                const language = editor.document.languageId;
                const line = editor.selection.active.line + 1;

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    filePath, 
                    content,
                    language,
                    currentLine: line
                }));
            } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: '열린 파일 없음' }));
            }
            return;
        }

        if (req.method === 'POST' && req.url === '/api/show-error') {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', () => {
                try {
                    const { message, filePath, line } = JSON.parse(body);

                    console.error(`❌ API 오류: ${message} (${filePath}:${line})`);

                    vscode.window.showErrorMessage(
                        `❌ 오류: ${message}`,
                        '파일 열기'
                    ).then(selection => {
                        if (selection === '파일 열기' && filePath) {
                            openFileInEditor(filePath);
                        }
                    });

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (err) {
                    console.error('❌ API show-error 오류:', err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: String(err) }));
                }
            });
            return;
        }

        if (req.method === 'GET' && req.url === '/api/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                status: '🛡️ 순욱 API 서버 정상 작동 중',
                port: 8502,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'API 없음' }));
    });

    server.listen(8502, 'localhost', () => {
        console.log('🛡️ 순욱 API 서버 시작: http://localhost:8502');
    });

    server.on('error', (err) => {
        console.error('❌ API 서버 오류:', err);
        vscode.window.showErrorMessage(`❌ API 서버 오류: ${err.message}`);
    });
}

export function deactivate() {
    if (server) {
        server.close();
        server = null;
        console.log('🛡️ 순욱 API 서버 종료');
    }
}