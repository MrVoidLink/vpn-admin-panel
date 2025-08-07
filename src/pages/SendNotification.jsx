import NotificationForm from "../components/notification/NotificationForm";
import NotificationList from "../components/notification/NotificationList";
import React, { useState } from "react";

export default function SendNotification() {
  const [refreshFlag, setRefreshFlag] = useState(false);

  const refreshList = () => {
    setRefreshFlag((f) => !f);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-0 py-10 space-y-12">
      <NotificationForm afterSend={refreshList} />
      <NotificationList key={refreshFlag} />
    </div>
  );
}
