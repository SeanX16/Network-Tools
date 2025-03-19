import requests
import json

# GitHub 仓库信息
repo_owner = "shindgewongxj"
repo_name = "WHATSINStash"
folder_path = "icon"  # 需要获取的文件夹路径

# GitHub API URL
api_url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/contents/{folder_path}"

# 发送请求
response = requests.get(api_url)
if response.status_code == 200:
    files = response.json()
    result = []
    
    # 遍历文件列表
    for file in files:
        if file["type"] == "file":  # 确保是文件而不是子目录
            file_name = file["name"]
            raw_url = file["download_url"]
            result.append({"name": file_name, "url": raw_url})
    
    # 生成 JSON 输出
    json_output = json.dumps(result, indent=4, ensure_ascii=False)
    
    # 保存到文件（可选）
    with open("output.json", "w", encoding="utf-8") as f:
        f.write(json_output)
    
    print("提取完成！JSON 文件已保存为 output.json")
    print(json_output)

else:
    print("获取文件列表失败，请检查仓库路径或 API 访问权限。")
