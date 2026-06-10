import { useState } from "react";
import reactLogo from "./assets/react.svg";
import tauriLogo from "./assets/tauri.svg";

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <div className="flex gap-8 mb-8">
        <a href="https://vitejs.dev" target="_blank" rel="noreferrer">
          <img src={tauriLogo} className="h-24 p-6" alt="Tauri logo" />
        </a>
        <a href="https://react.dev" target="_blank" rel="noreferrer">
          <img src={reactLogo} className="h-24 p-6" alt="React logo" />
        </a>
      </div>
      <h1 className="text-4xl font-bold mb-4">OpenSpec Workbench</h1>
      <div className="p-8">
        <button
          type="button"
          onClick={() => setCount((c) => c + 1)}
          className="rounded bg-blue-600 text-white px-4 py-2 hover:bg-blue-700"
        >
          count is {count}
        </button>
        <p className="mt-4 text-gray-600">
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
    </div>
  );
}

export default App;
