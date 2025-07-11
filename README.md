# GitHub Repository Chat AI

This project is an AI-powered chat application designed to facilitate understanding and interaction with public GitHub repositories. It allows users to gain insights into codebase structure, summarize functionalities, and receive detailed answers to questions about the code, enhancing code comprehension and exploration.

## Features

*   **Chat with any public GitHub repository:** Simply provide a repository URL to start a conversation.
*   **AI-powered summaries:** Get quick summaries of code files and functionalities.
*   **Interactive Q&A:** Ask specific questions about the code and get detailed answers.
*   **Source code linking:** Responses include links to the relevant source code in the repository.
*   **Text-to-Speech (TTS):** Listen to AI responses with integrated text-to-speech functionality.

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

*   **Node.js:** This project requires Node.js to be installed on your machine. Node.js is a JavaScript runtime that allows you to run the development server and other project scripts. You can download it from [nodejs.org](https://nodejs.org/).
*   **npm:** The Node Package Manager (npm) is included with Node.js and is used to manage project dependencies.
*   **ngrok (Optional, for public access):** If you wish to expose your local development server to the internet, `ngrok` can be used. Instructions for setting it up are not covered here, but you can find them on the [ngrok website](https://ngrok.com/).

### Installation

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/hassenhamdi/github-repo-chat-ai.git
    ```
2.  **Navigate to the project directory:**
    ```sh
    cd github-repo-chat-ai
    ```
3.  **Install dependencies:**
    ```sh
    npm install
    ```
4.  **Set up your environment variables:**
    Create a `.env.local` file in the root of the project and add your Gemini API key and optionally your ngrok URL:
    ```
    GEMINI_API_KEY=your_api_key_here
    VITE_APP_NGROK_URL=your_ngrok_url_here
    ```
5.  **Run the development server:**
    This command starts the Vite development server.
    ```sh
    npm run dev
    ```
The application will be available at `http://localhost:5173` (or the next available port).

## Technologies Used

*   **React:** A JavaScript library for building user interfaces.
*   **Vite:** A modern frontend build tool that provides a faster and leaner development experience for web projects.
*   **TypeScript:** A typed superset of JavaScript that compiles to plain JavaScript.
*   **Google Gemini:** The AI model powering the chat functionality.
*   **Marked:** A markdown parser for rendering formatted text.
*   **DOMPurify:** A DOM-only, super-fast, and uber-tolerant XSS sanitizer.
*   **Web Speech API:** Used for text-to-speech functionality.

## Contributing

Contributions are welcome! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get involved.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
# Github-Repo-Chat
