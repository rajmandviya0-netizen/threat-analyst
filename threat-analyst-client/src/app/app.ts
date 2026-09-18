import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';

interface Alert {
  id: number;
  rule_name: string;
  severity: string;
  description: string;
  created_at: string;
  explanation?: string;
  mitre_id?: string;
  mitre_technique?: string;
  triaging?: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, OnDestroy {
  alerts = signal<Alert[]>([]);
  searchQuery = '';
  searching = false;
  private socket!: Socket;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadAlerts();
    this.socket = io('http://localhost:4000');
    this.socket.on('newAlert', (alert: Alert) => {
      this.alerts.update(current => [alert, ...current]);
    });
  }

  ngOnDestroy() {
    if (this.socket) this.socket.disconnect();
  }

  loadAlerts() {
    this.http.get<Alert[]>('http://localhost:4000/api/alerts').subscribe({
      next: (data) => this.alerts.set(data),
      error: (err) => console.error('Failed to load alerts:', err)
    });
  }

  search() {
    if (!this.searchQuery.trim()) {
      this.loadAlerts();
      return;
    }
    this.searching = true;
    this.http.post<Alert[]>('http://localhost:4000/api/alerts/search', { query: this.searchQuery }).subscribe({
      next: (data) => {
        this.alerts.set(data);
        this.searching = false;
      },
      error: (err) => {
        console.error('Search failed:', err);
        this.searching = false;
      }
    });
  }

  clearSearch() {
    this.searchQuery = '';
    this.loadAlerts();
  }

  triageAlert(alert: Alert) {
    this.alerts.update(current =>
      current.map(a => a.id === alert.id ? { ...a, triaging: true } : a)
    );
    this.http.post<any>(`http://localhost:4000/api/alerts/${alert.id}/triage`, {}).subscribe({
      next: (result) => {
        this.alerts.update(current =>
          current.map(a => a.id === alert.id ? {
            ...a,
            triaging: false,
            explanation: result.explanation,
            mitre_id: result.mitreId,
            mitre_technique: result.mitreTechnique
          } : a)
        );
      },
      error: (err) => {
        console.error('Triage failed:', err);
        this.alerts.update(current =>
          current.map(a => a.id === alert.id ? { ...a, triaging: false } : a)
        );
      }
    });
  }

  severityColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#7f1d1d';
      case 'high': return '#dc2626';
      case 'medium': return '#f59e0b';
      case 'low': return '#22c55e';
      default: return '#6b7280';
    }
  }

  get totalAlerts() {
    return this.alerts().length;
  }

  get highCriticalCount() {
    return this.alerts().filter(a => a.severity === 'high' || a.severity === 'critical').length;
  }

  get triagedCount() {
    return this.alerts().filter(a => a.explanation).length;
  }
}