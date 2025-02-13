import fs from 'fs';
import path from 'path';

// 定义领域、技术、应用等模板
const topics = ["blockchain", "AI", "cryptography", "quantum computing", "machine learning", "5G", "cybersecurity", "IoT", "big data"];
const industries = ["healthcare", "finance", "education", "manufacturing", "marketing", "security", "logistics", "retail", "banking"];
const methods = ["decentralized finance", "cloud computing", "data encryption", "predictive analytics", "facial recognition", "digital identity"];
const applications = ["supply chain", "personalization", "automation", "security", "customer service", "productivity", "e-commerce"];

// 输出文件夹路径
const outputFolder = '.';
if (!fs.existsSync(outputFolder)) {
  fs.mkdirSync(outputFolder);
}

// 输出文件路径
const outputFilePath = path.join(outputFolder, 'questions.json');

// 目标生成问题数量
const targetNumber = 1000;

// 增加多样性：加入更多的随机细节
function generateRandomQuestion() {
  const topic = topics[Math.floor(Math.random() * topics.length)];
  const industry = industries[Math.floor(Math.random() * industries.length)];
  const method = methods[Math.floor(Math.random() * methods.length)];
  const application = applications[Math.floor(Math.random() * applications.length)];

  // 通过随机选择一种句型构造问题，增加多样性
  const questionTemplates = [
    `How does ${topic} improve ${industry}?`,
    `What are the benefits of ${topic} in ${industry}?`,
    `Why is ${topic} crucial for ${industry}?`,
    `How can ${method} revolutionize ${industry}?`,
    `What impact does ${method} have on ${application}?`,
    `Why should ${method} be applied to ${industry}?`,
    `How does ${topic} affect ${application}?`,
    `In what ways can ${topic} be integrated into ${industry}?`
  ];

  const questionTemplate = questionTemplates[Math.floor(Math.random() * questionTemplates.length)];
  return questionTemplate;
}

// 生成并写入问题
const questions = [];
for (let i = 0; i < targetNumber; i++) {
  const question = generateRandomQuestion();
  questions.push(question);

  // 每生成一定数量的问题时打印进度
  if (i % (targetNumber / 100) === 0) {  // 每完成1%的任务，输出进度
    const progress = ((i + 1) / targetNumber) * 100;
  }
}

// 将问题列表保存为 JSON 文件
fs.writeFileSync(outputFilePath, JSON.stringify(questions, null, 4), 'utf8');
