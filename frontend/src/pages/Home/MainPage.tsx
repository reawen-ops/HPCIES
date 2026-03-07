import { useEffect, useState } from "react";
import Header from "../../components/layout/Header/Header";
import Sidebar from "../../components/layout/Sidebar/Sidebar";
import ScrollPanel from "../../components/layout/Scroll/ScrollPanel";
import StatisticsInfo from "../../components/common/StatisticsInfo";
import PredictionChart from "../../components/ui/Chart/PredictionChart";
import NodeMatrix from "../../components/ui/Chart/NodeMatrix";
import ChatContainer from "../../components/common/ChatContainer";
import Welcome from "../../components/features/Welcome";
import styles from "./MainPage.module.scss";
import { useAuth } from "../../auth/AuthProvider";

const MainPage = () => {
  const { profile, refreshMe } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );

  useEffect(() => {
    // 进入首页时刷新 profile，用于决定是否显示 Welcome（只在未配置/未上传时显示）
    refreshMe().catch(() => {});
  }, [refreshMe]);

  // 直接在渲染阶段计算派生状态，避免在 effect 中 setState
  const needsSetup =
    !profile ||
    profile.has_history !== 1 ||
    profile.node_count == null ||
    profile.core_per_node == null;

  const handleCompleteConfig = () => {
    // 配置完成后刷新一次，让各组件用到最新配置/数据
    // 不再手动设置 showWelcome，依赖 profile 更新后重新计算 needsSetup
    refreshMe().catch(() => {});
  };

  return (
    <div>
      <Header />
      <div className={styles["main-container"]}>
        <Sidebar onSelectDate={setSelectedDate} />
        <div className={styles["content-area"]}>
          <ScrollPanel>
            <StatisticsInfo />
            <PredictionChart
              selectedDate={selectedDate}
              onChangeDate={setSelectedDate}
            />
            <NodeMatrix />
            <ChatContainer />
          </ScrollPanel>
        </div>
      </div>
      {needsSetup && <Welcome onComplete={handleCompleteConfig} />}
    </div>
  );
};

export default MainPage;
