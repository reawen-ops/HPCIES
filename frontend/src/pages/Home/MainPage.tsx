import { useState } from "react";
import Header from "../../components/layout/Header/Header";
import Sidebar from "../../components/layout/Sidebar/Sidebar";
import ScrollPanel from "../../components/layout/Scroll/ScrollPanel";
import StatisticsInfo from "../../components/common/StatisticsInfo";
import PredictionChart from "../../components/ui/Chart/PredictionChart";
import NodeMatrix from "../../components/ui/Chart/NodeMatrix";
import ChatContainer from "../../components/common/ChatContainer";
import Welcome from "../../components/features/Welcome";
import styles from "./MainPage.module.scss";

const MainPage = () => {
  const [showWelcome, setShowWelcome] = useState(true);
  const [nodeCount, setNodeCount] = useState<number>(128);

  const handleCompleteConfig = (config: {
    nodeCount: number;
    corePerNode: number;
  }) => {
    if (config.nodeCount > 0) {
      setNodeCount(config.nodeCount);
    }
    setShowWelcome(false);
  };

  return (
    <div>
      <Header />
      <div className={styles["main-container"]}>
        <Sidebar />
        <div className={styles["content-area"]}>
          <ScrollPanel>
            <StatisticsInfo />
            <PredictionChart />
            <NodeMatrix nodeCount={nodeCount} />
            <ChatContainer />
          </ScrollPanel>
        </div>
      </div>
      {showWelcome && <Welcome onComplete={handleCompleteConfig} />}
    </div>
  );
};

export default MainPage;


