import { Component, OnInit } from '@angular/core';
import { ChatbotService } from 'src/app/core/services/chatbot.service';

@Component({
  selector: 'app-chatbot',
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.css']
})
export class ChatbotComponent implements OnInit {
  messages: { text: string; isUser: boolean }[] = [];
  userInput = '';
  isProcessing = false;

  constructor(private chatbotService: ChatbotService) {}

  ngOnInit() {
    this.addBotMessage('Bonjour, comment puis-je vous aider avec votre stock?');
  }

  async sendMessage() {
    if (!this.userInput.trim() || this.isProcessing) return;
    
    const userMessage = this.userInput;
    this.addUserMessage(userMessage);
    this.userInput = '';
    this.isProcessing = true;
    
    try {
      const response = await this.chatbotService.processQuestion(userMessage);
      this.addBotMessage(response);
    } catch (error) {
      this.addBotMessage("Désolé, je rencontre un problème technique.");
    } finally {
      this.isProcessing = false;
    }
  }

  private addUserMessage(text: string) {
    this.messages.push({ text, isUser: true });
  }

  private addBotMessage(text: string) {
    this.messages.push({ text, isUser: false });
  }
}