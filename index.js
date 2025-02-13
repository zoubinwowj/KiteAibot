import fetch from 'node-fetch';
import chalk from 'chalk';
import readline from 'readline';
import fs from 'fs/promises';
import { banner } from './banner.js';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import './question.js';


const waitForKeyPress = async () => {
    process.stdin.setRawMode(true);
    return new Promise(resolve => {
        process.stdin.once('data', () => {
            process.stdin.setRawMode(false);
            resolve();
        });
    });
};

async function loadWallets() {
    try {
        const data = await fs.readFile('wallets.txt', 'utf8');
        const wallets = data.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
        
        if (wallets.length === 0) {
            throw new Error('wallets.txt 文件中未找到钱包地址');
        }
        return wallets;
    } catch (err) {
        console.log(`${chalk.red('[错误]')} 读取 wallets.txt 文件时出错: ${err.message}`);
        process.exit(1);
    }
}

async function loadProxies() {
    try {
        const data = await fs.readFile('proxies.txt', 'utf8');
        return data.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
            .map(proxy => {
                if (proxy.includes('://')) {
                    const url = new URL(proxy);
                    const protocol = url.protocol.replace(':', '');
                    const auth = url.username ? `${url.username}:${url.password}` : '';
                    const host = url.hostname;
                    const port = url.port;
                    return { protocol, host, port, auth };
                } else {
                    const parts = proxy.split(':');
                    let [protocol, host, port, user, pass] = parts;
                    protocol = protocol.replace('//', '');
                    const auth = user && pass ? `${user}:${pass}` : '';
                    return { protocol, host, port, auth };
                }
            });
    } catch (err) {
        console.log(`${chalk.yellow('[提示]')} 未找到 proxies.txt 文件或读取文件时出错。使用直连模式。`);
        return [];
    }
}

async function loadQuestions() {
    try {
        const data = await fs.readFile('questions.json', 'utf8');
        const questions = JSON.parse(data);
        if (!Array.isArray(questions)) { // 修正右括号的位置
            throw new Error('questions.json 文件格式不正确，应为问题数组');
        }
        return questions;
    } catch (err) {
        console.log(`${chalk.red('[错误]')} 读取 questions.json 文件时出错: ${err.message}`);
        process.exit(1);
    }
}

function createAgent(proxy) {
    if (!proxy) return null;
    
    const { protocol, host, port, auth } = proxy;
    const authString = auth ? `${auth}@` : '';
    const proxyUrl = `${protocol}://${authString}${host}:${port}`;
    
    return protocol.startsWith('socks') 
        ? new SocksProxyAgent(proxyUrl)
        : new HttpsProxyAgent(proxyUrl);
}

const AI_ENDPOINTS = {
    "https://deployment-uu9y1z4z85rapgwkss1muuiz.stag-vxzy.zettablock.com/main": {
        "agent_id": "deployment_UU9y1Z4Z85RAPGwkss1mUUiZ",
        "name": "Kite AI Assistant",
        "questions": []
    },
    "https://deployment-ecz5o55dh0dbqagkut47kzyc.stag-vxzy.zettablock.com/main": {
        "agent_id": "deployment_ECz5O55dH0dBQaGKuT47kzYC",
        "name": "Crypto Price Assistant",
        "questions": []
    },
    "https://deployment-sofftlsf9z4fya3qchykaanq.stag-vxzy.zettablock.com/main": {
        "agent_id": "deployment_SoFftlsf9z4fyA3QCHYkaANq",
        "name": "Transaction Analyzer",
        "questions": []
    }
};

class WalletStatistics {
    constructor() {
        this.agentInteractions = {};
        for (const endpoint in AI_ENDPOINTS) {
            this.agentInteractions[AI_ENDPOINTS[endpoint].name] = 0;
        }
        this.totalPoints = 0;
        this.totalInteractions = 0;
        this.lastInteractionTime = null;
        this.successfulInteractions = 0;
        this.failedInteractions = 0;
    }
}

class WalletSession {
    constructor(walletAddress, sessionId) {
        this.walletAddress = walletAddress;
        this.sessionId = sessionId;
        this.dailyPoints = 0;
        this.startTime = new Date();
        this.nextResetTime = new Date(this.startTime.getTime() + 24 * 60 * 60 * 1000);
        this.statistics = new WalletStatistics();
    }

    updateStatistics(agentName, success = true) {
        this.statistics.agentInteractions[agentName]++;
        this.statistics.totalInteractions++;
        this.statistics.lastInteractionTime = new Date();
        if (success) {
            this.statistics.successfulInteractions++;
            this.statistics.totalPoints += 10; // 每次成功交互的积分
        } else {
            this.statistics.failedInteractions++;
        }
    }

    printStatistics() {
        console.log(`\n${chalk.blue(`[会话 ${this.sessionId}]`)} ${chalk.green(`[${this.walletAddress}]`)} ${chalk.cyan('📊 当前统计')}`);
        console.log(`${chalk.yellow('════════════════════════════════════════════')}`);
        console.log(`${chalk.cyan('💰 总积分:')} ${chalk.green(this.statistics.totalPoints)}`);
        console.log(`${chalk.cyan('🔄 总交互次数:')} ${chalk.green(this.statistics.totalInteractions)}`);
        console.log(`${chalk.cyan('✅ 成功:')} ${chalk.green(this.statistics.successfulInteractions)}`);
        console.log(`${chalk.cyan('❌ 失败:')} ${chalk.red(this.statistics.failedInteractions)}`);
        console.log(`${chalk.cyan('⏱️ 上次交互时间:')} ${chalk.yellow(this.statistics.lastInteractionTime?.toISOString() || '从未')}`);
        
        console.log(`\n${chalk.cyan('🤖 助手交互次数:')}`);
        for (const [agentName, count] of Object.entries(this.statistics.agentInteractions)) {
            console.log(`   ${chalk.yellow(agentName)}: ${chalk.green(count)}`);
        }
        console.log(chalk.yellow('════════════════════════════════════════════\n'));
    }
}

class KiteAIAutomation {
    constructor(walletAddress, proxyList = [], sessionId) {
        this.session = new WalletSession(walletAddress, sessionId);
        this.proxyList = proxyList;
        this.currentProxyIndex = 0;
        this.MAX_DAILY_POINTS = 200;
        this.POINTS_PER_INTERACTION = 10;
        this.MAX_DAILY_INTERACTIONS = this.MAX_DAILY_POINTS / this.POINTS_PER_INTERACTION;
        this.isRunning = true;
    }

    getCurrentProxy() {
        if (this.proxyList.length === 0) return null;
        return this.proxyList[this.currentProxyIndex];
    }

    rotateProxy() {
        if (this.proxyList.length === 0) return null;
        this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxyList.length;
        const proxy = this.getCurrentProxy();
        this.logMessage('🔄', `切换到代理: ${proxy.protocol}://${proxy.host}:${proxy.port}`, 'cyan');
        return proxy;
    }

    logMessage(emoji, message, color = 'white') {
        const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const sessionPrefix = chalk.blue(`[会话 ${this.session.sessionId}]`);
        const walletPrefix = chalk.green(`[${this.session.walletAddress.slice(0, 6)}...]`);
        console.log(`${chalk.yellow(`[${timestamp}]`)} ${sessionPrefix} ${walletPrefix} ${chalk[color](`${emoji} ${message}`)}`);
    }

    resetDailyPoints() {
        const currentTime = new Date();
        if (currentTime >= this.session.nextResetTime) {
            this.logMessage('✨', '开始新的 24 小时奖励周期', 'green');
            this.session.dailyPoints = 0;
            this.session.nextResetTime = new Date(currentTime.getTime() + 24 * 60 * 60 * 1000);
            return true;
        }
        return false;
    }

    async shouldWaitForNextReset() {
        if (this.session.dailyPoints >= this.MAX_DAILY_POINTS) {
            const waitSeconds = (this.session.nextResetTime - new Date()) / 1000;
            if (waitSeconds > 0) {
                this.logMessage('🎯', `已达到每日最大积分 (${this.MAX_DAILY_POINTS})`, 'yellow');
                this.logMessage('⏳', `下次重置时间: ${this.session.nextResetTime.toISOString().replace('T', ' ').slice(0, 19)}`, 'yellow');
                await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
                this.resetDailyPoints();
            }
            return true;
        }
        return false;
    }

    async getRecentTransactions() {
        this.logMessage('🔍', '扫描最近的交易...', 'white');
        const url = 'https://testnet.kitescan.ai/api/v2/advanced-filters';
        const params = new URLSearchParams({
            transaction_types: 'coin_transfer',
            age: '5m'
        });

        try {
            const agent = createAgent(this.getCurrentProxy());
            const response = await fetch(`${url}?${params}`, {
                agent,
                headers: {
                    'accept': '*/*',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            const data = await response.json();
            const hashes = data.items?.map(item => item.hash) || [];
            this.logMessage('📊', `找到 ${hashes.length} 笔最近的交易`, 'magenta');
            return hashes;
        } catch (e) {
            this.logMessage('❌', `获取交易时出错: ${e}`, 'red');
            this.rotateProxy();
            return [];
        }
    }

    async sendAiQuery(endpoint, message) {
        const agent = createAgent(this.getCurrentProxy());
        const headers = {
            'Accept': 'text/event-stream',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };
        const data = {
            message,
            stream: true
        };

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                agent,
                headers,
                body: JSON.stringify(data)
            });

            const sessionPrefix = chalk.blue(`[会话 ${this.session.sessionId}]`);
            const walletPrefix = chalk.green(`[${this.session.walletAddress.slice(0, 6)}...]`);
            process.stdout.write(`${sessionPrefix} ${walletPrefix} ${chalk.cyan('🤖 AI 回复: ')}`);
            
            let accumulatedResponse = "";

            for await (const chunk of response.body) {
                const lines = chunk.toString().split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonStr = line.slice(6);
                            if (jsonStr === '[DONE]') break;

                            const jsonData = JSON.parse(jsonStr);
                            const content = jsonData.choices?.[0]?.delta?.content || '';
                            if (content) {
                                accumulatedResponse += content;
                                process.stdout.write(chalk.magenta(content));
                            }
                        } catch (e) {
                            continue;
                        }
                    }
                }
            }
            console.log();
            return accumulatedResponse.trim();
        } catch (e) {
            this.logMessage('❌', `AI 查询出错: ${e}`, 'red');
            this.rotateProxy();
            return "";
        }
    }

    async reportUsage(endpoint, message, response) {
        this.logMessage('📝', '记录交互...', 'white');
        const url = 'https://quests-usage-dev.prod.zettablock.com/api/report_usage';
        const data = {
            wallet_address: this.session.walletAddress,
            agent_id: AI_ENDPOINTS[endpoint].agent_id,
            request_text: message,
            response_text: response,
            request_metadata: {}
        };

        try {
            const agent = createAgent(this.getCurrentProxy());
            const result = await fetch(url, {
                method: 'POST',
                agent,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                body: JSON.stringify(data)
            });
            return result.status === 200;
        } catch (e) {
            this.logMessage('❌', `记录交互时出错: ${e}`, 'red');
            this.rotateProxy();
            return false;
        }
    }

    async run() {
        this.logMessage('🚀', '初始化 Kite AI 自动交互系统', 'green');
        this.logMessage('💼', `钱包地址: ${this.session.walletAddress}`, 'cyan');
        this.logMessage('🎯', `每日目标: ${this.MAX_DAILY_POINTS} 积分 (${this.MAX_DAILY_INTERACTIONS} 次交互)`, 'cyan');
        this.logMessage('⏰', `下次重置时间: ${this.session.nextResetTime.toISOString().replace('T', ' ').slice(0, 19)}`, 'cyan');
        
        if (this.proxyList.length > 0) {
            this.logMessage('🌐', `已加载 ${this.proxyList.length} 个代理`, 'cyan');
        } else {
            this.logMessage('🌐', '使用直连模式', 'yellow');
        }

        let interactionCount = 0;
        try {
            while (this.isRunning) {
                this.resetDailyPoints();
                await this.shouldWaitForNextReset();

                interactionCount++;
                console.log(`\n${chalk.blue(`[会话 ${this.session.sessionId}]`)} ${chalk.green(`[${this.session.walletAddress}]`)} ${chalk.cyan('═'.repeat(60))}`);
                this.logMessage('🔄', `第 ${interactionCount} 次交互`, 'magenta');
                this.logMessage('📈', `进度: ${this.session.dailyPoints + this.POINTS_PER_INTERACTION}/${this.MAX_DAILY_POINTS} 积分`, 'cyan');
                this.logMessage('⏳', `下次重置时间: ${this.session.nextResetTime.toISOString().replace('T', ' ').slice(0, 19)}`, 'cyan');

                const transactions = await this.getRecentTransactions();
                AI_ENDPOINTS["https://deployment-sofftlsf9z4fya3qchykaanq.stag-vxzy.zettablock.com/main"].questions = 
                    transactions.map(tx => `详细分析此交易: ${tx}`);

                const endpoints = Object.keys(AI_ENDPOINTS);
                const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
                const questions = await loadQuestions();
                const question = questions[Math.floor(Math.random() * questions.length)];

                this.logMessage('🤖', `AI 系统: ${AI_ENDPOINTS[endpoint].name}`, 'cyan');
                this.logMessage('🔑', `助手 ID: ${AI_ENDPOINTS[endpoint].agent_id}`, 'cyan');
                this.logMessage('❓', `问题: ${question}`, 'cyan');

                const response = await this.sendAiQuery(endpoint, question);
                let interactionSuccess = false;

                if (await this.reportUsage(endpoint, question, response)) {
                    this.logMessage('✅', '交互记录成功', 'green');
                    this.session.dailyPoints += this.POINTS_PER_INTERACTION;
                    interactionSuccess = true;
                } else {
                    this.logMessage('⚠️', '交互记录失败', 'red');
                }

                // 更新本次交互的统计信息
                this.session.updateStatistics(AI_ENDPOINTS[endpoint].name, interactionSuccess);
                
                // 每次交互后显示当前统计信息
                this.session.printStatistics();

                const delay = Math.random() * 2 + 1;
                this.logMessage('⏳', `冷却时间: ${delay.toFixed(1)} 秒...`, 'yellow');
                await new Promise(resolve => setTimeout(resolve, delay * 1000));
            }
        } catch (e) {
            if (e.name === 'AbortError') {
                this.logMessage('🛑', '用户终止了进程', 'yellow');
            } else {
                this.logMessage('❌', `错误: ${e}`, 'red');
            }
        }
    }

    stop() {
        this.isRunning = false;
    }
}

async function main() {
    console.clear();
    
    // 显示初始注册信息
    console.log(`${chalk.cyan('📝 先注册:')} ${chalk.green('https://testnet.gokite.ai?r=kxsQ3byj')}`);
    console.log(`${chalk.yellow('💡 如有问题，请加入我们的频道')}\n`);
    console.log(chalk.magenta('按任意键继续...'));
    
    await waitForKeyPress();
    console.clear();
    
    console.log(banner);
    
    // 加载钱包和代理
    const wallets = await loadWallets();
    const proxyList = await loadProxies();
    
    console.log(`${chalk.cyan('📊 已加载:')} ${chalk.green(wallets.length)} 个钱包和 ${chalk.green(proxyList.length)} 个代理\n`);
    
    // 为每个钱包创建实例并分配唯一的会话 ID
    const instances = wallets.map((wallet, index) => 
        new KiteAIAutomation(wallet, proxyList, index + 1)
    );
    
    // 显示初始统计信息标题
    console.log(chalk.cyan('\n════════════════════════'));
    console.log(chalk.cyan('🤖 启动所有会话'));
    console.log(chalk.cyan('════════════════════════\n'));
    
    // 运行所有实例
    try {
        await Promise.all(instances.map(instance => instance.run()));
    } catch (error) {
        console.log(`\n${chalk.red('❌ 致命错误:')} ${error.message}`);
    }
}

// 处理进程终止
process.on('SIGINT', () => {
    console.log(`\n${chalk.yellow('🛑 正在优雅地关闭...')}`);
    process.exit(0);
});

// 全局错误处理
process.on('unhandledRejection', (error) => {
    console.error(`\n${chalk.red('❌ 未处理的拒绝:')} ${error.message}`);
});

main().catch(error => {
    console.error(`\n${chalk.red('❌ 致命错误:')} ${error.message}`);
    process.exit(1);
});