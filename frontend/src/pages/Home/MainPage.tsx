import { useState } from "react";
import Header from "../../components/layout/Header/Header";
import Sidebar from "../../components/layout/Sidebar/Sidebar";
import ScrollPanel from "../../components/layout/Scroll/ScrollPanel";
import StatisticsInfo from "../../components/common/StatisticsInfo";
import PredictionChart from "../../components/ui/Chart/PredictionChart";
import NodeMatrix from "../../components/ui/Chart/NodeMatrix";
import ChatContainer from "../../components/common/ChatContainer";
import Welcome from "../../components/features/Welcome";
import LoadPredictor from "../../components/features/LoadPredictor/LoadPredictor";
import styles from "./MainPage.module.scss";

const MainPage = () => {
  const [showWelcome, setShowWelcome] = useState(true);

  const handleCompleteConfig = () => {
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
            <LoadPredictor />
            <NodeMatrix />
            <ChatContainer />
          </ScrollPanel>
        </div>
      </div>
      {showWelcome && <Welcome onComplete={handleCompleteConfig} />}
    </div>
  );
};

export default MainPage;
