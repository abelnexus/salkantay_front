import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-me',
  imports: [DatePipe],
  templateUrl: './me.html',
  styleUrl: './me.scss',
})
export class Me {
  protected readonly auth = inject(AuthService);
}
