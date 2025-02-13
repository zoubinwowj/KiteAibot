import random
import os
import json

# 定义领域、技术、应用等模板
topics = ["blockchain", "AI", "cryptography", "quantum computing", "machine learning", "5G", "cybersecurity", "IoT", "big data"]
industries = ["healthcare", "finance", "education", "manufacturing", "marketing", "security", "logistics", "retail", "banking"]
methods = ["decentralized finance", "cloud computing", "data encryption", "predictive analytics", "facial recognition", "digital identity"]
applications = ["supply chain", "personalization", "automation", "security", "customer service", "productivity", "e-commerce"]

# 输出文件夹路径
output_folder = "generated_questions"
os.makedirs(output_folder, exist_ok=True)

# 输出文件路径
output_file_path = os.path.join(output_folder, "questions.json")

# 目标生成问题数量
target_number = 1000

# 增加多样性：加入更多的随机细节
def generate_random_question():
    topic = random.choice(topics)
    industry = random.choice(industries)
    method = random.choice(methods)
    application = random.choice(applications)

    # 通过随机选择一种句型构造问题，增加多样性
    question_template = random.choice([
        f'How does {topic} improve {industry}?',
        f'What are the benefits of {topic} in {industry}?',
        f'Why is {topic} crucial for {industry}?',
        f'How can {method} revolutionize {industry}?',
        f'What impact does {method} have on {application}?',
        f'Why should {method} be applied to {industry}?',
        f'How does {topic} affect {application}?',
        f'In what ways can {topic} be integrated into {industry}?'
    ])

    return question_template

# 生成并写入问题
questions = []
for i in range(target_number):
    question = generate_random_question()
    questions.append(question)

    # 每生成一定数量的问题时打印进度
    if i % (target_number // 100) == 0:  # 每完成1%的任务，输出进度
        progress = (i + 1) / target_number * 100
        print(f"Progress: {progress:.2f}%")

# 将问题列表保存为 JSON 文件
with open(output_file_path, 'w', encoding='utf-8') as f:
    json.dump(questions, f, ensure_ascii=False, indent=4)

print(f"问题已生成并保存到 {output_file_path}")
