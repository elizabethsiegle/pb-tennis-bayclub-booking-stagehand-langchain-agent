import ChatWindow from './components/ChatWindow';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>🎾 Tennis and Pickleball 🥒 Court Booking</h1>
        <p>Bay Club Gateway - San Francisco</p>
      </header>
      <ChatWindow />
    </div>
  );
}

export default App;
