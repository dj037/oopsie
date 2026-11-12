import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { StoreProvider } from "./lib/store";
import { NetworkLoading } from "./components/NetworkLoading";
import "./styles.css";
import "./reference.css";
import "./flow.css";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error)
      return (
        <div className="loading-screen">
          <h1>刚刚打了个小盹。</h1>
          <p>页面遇到了问题，已保存的行程仍然保留。</p>
          <button className="button primary" onClick={() => location.reload()}>
            重新打开
          </button>
        </div>
      );
    return this.props.children;
  }
}
const root: ReactDOM.Root =
  import.meta.hot?.data.oopsieRoot ??
  ReactDOM.createRoot(document.getElementById("root")!);
if (import.meta.hot) import.meta.hot.data.oopsieRoot = root;
root.render(
  <ErrorBoundary>
    <StoreProvider>
      <App />
      <NetworkLoading />
    </StoreProvider>
  </ErrorBoundary>,
);
if (import.meta.env.PROD && "serviceWorker" in navigator)
  void navigator.serviceWorker.register("/sw.js").catch(() => {});
