import requests
import json
import email.utils
import pandas as pd
from datetime import datetime, timedelta

url = "https://lstm-api-bchjuwvtgg.cn-hangzhou.fcapp.run"
csv_file_path = '使用率20250401_20251130.csv'

# ==========================================
# 🌟 1. 指定你要进行“单步滚动回测”的具体日期
# ==========================================
target_date_str = "2025-11-15"

print(f"正在读取并清洗本地 CSV 文件: {csv_file_path} ...")
try:
    df = pd.read_csv(csv_file_path)
except FileNotFoundError:
    print(f"❌ 找不到文件 {csv_file_path}")
    exit()

df = df[df['日期'] != '日期'].copy()
df['小时'] = df['小时'].astype(str).str.zfill(2)
df['完整时间'] = pd.to_datetime(df['日期'] + ' ' + df['小时'] + ':00:00')
df['CPU核时使用量'] = df['CPU核时使用量'].astype(float)

print(f"\n🚀 开始执行单步滚动回测 (One-Step-Ahead) - 目标日期: {target_date_str}")
print("-" * 80)
print(f"{'预测时间':<10} | {'真实负载':<10} | {'预测负载':<10} | {'绝对误差(%)':<10} | {'建议开启节点数'}")
print("-" * 80)

# 模拟一天 24 小时的时间流逝
for hour in range(24):
    # 当前要预测的精准时间点
    target_predict_time = pd.to_datetime(f"{target_date_str} {hour:02d}:00:00")
    
    # 截取前 24 小时的真实历史数据
    start_dt = target_predict_time - timedelta(hours=24)
    end_dt = target_predict_time - timedelta(hours=1)
    
    mask = (df['完整时间'] >= start_dt) & (df['完整时间'] <= end_dt)
    historical_data = df.loc[mask].sort_values(by='完整时间')
    
    if len(historical_data) != 24:
        print(f"⚠️ {target_predict_time.strftime('%H:%M')} 之前的数据不足 24 小时，跳过本轮测试。")
        continue

    history_24h_list = historical_data['CPU核时使用量'].tolist()
    last_timestamp_str = historical_data['完整时间'].iloc[-1].strftime("%Y-%m-%d %H:%M:%S")

    # 获取当前这个小时在 CSV 里的“真实数据”，用于对比
    actual_mask = df['完整时间'] == target_predict_time
    if actual_mask.any():
        actual_load = df.loc[actual_mask, 'CPU核时使用量'].values[0]
    else:
        actual_load = None

    # ==========================================
    # 🌟 2. 核心魔法：只预测未来 1 个小时！
    # ==========================================
    payload = {
        "history_24h": history_24h_list,
        "last_timestamp": last_timestamp_str,
        "predict_hours": 1  
    }

    headers = {
        'Content-Type': 'application/json',
        'Date': email.utils.formatdate(usegmt=True)
    }

    try:
        # 发送请求给云端
        response = requests.post(url, data=json.dumps(payload), headers=headers)
        
        if response.status_code == 200:
            parsed_response = response.json()
            
            # 提取预测结果
            pred_data = parsed_response['predictions'][0]
            predicted_load = pred_data['predicted_load']
            suggested_nodes = pred_data['suggested_nodes']
            
            # 计算预测误差百分比
            if actual_load is not None and actual_load > 0:
                error_percent = abs(predicted_load - actual_load) / actual_load * 100
                error_str = f"{error_percent:.1f}%"
            else:
                error_str = "N/A"
                
            # 打印对比结果
            actual_load_str = f"{actual_load:.2f}" if actual_load is not None else "N/A"
            print(f"{target_predict_time.strftime('%H:%M'):<10} | {actual_load_str:<10} | {predicted_load:<10.2f} | {error_str:<10} | {suggested_nodes} 台")
        else:
            print(f"❌ 请求失败，状态码: {response.status_code}")
            
    except Exception as e:
        print(f"网络请求发生异常: {e}")

print("-" * 80)
print("✅ 回测完成！")