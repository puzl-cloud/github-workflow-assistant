import { useAsync } from "@/lib/useAsync.js";
import { useEffect } from "react";
import { getUser } from "@/models/GitHubPlatform/GitHub.js";

export const UserInfo = () => {
  const { data: user, error, isLoading, run } = useAsync();
  //
  // useEffect(() => {
  //   run(getUser());
  // }, []);

  if (!user) {
    return null;
  }

  return (
    <div className="user-info">
      <h2>User Information</h2>
      <p>
        <strong>Name:</strong> {user.name}
      </p>
      <p>
        <strong>Email:</strong> {user.email}
      </p>
      <p>
        <strong>Username:</strong> {user.username}
      </p>
      <p>
        <strong>Organisation:</strong> {user.organisation}
      </p>
    </div>
  );
};
