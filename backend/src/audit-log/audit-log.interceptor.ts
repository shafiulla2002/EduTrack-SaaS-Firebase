import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService } from './audit-log.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = req.method;
    const url = req.url;

    // Only audit state-modifying requests (POST, PUT, DELETE, PATCH)
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next.handle();
    }

    const userId = req.user?.id || req.headers['x-performed-by'] || 'SYSTEM_ADMIN';
    const action = `${method} ${url}`;

    return next.handle().pipe(
      tap(() => {
        this.auditLogService.logAction(
          userId,
          action,
          'REST_API',
          req.params?.id || null,
          { body: req.body, ip: req.ip }
        ).catch(() => {});
      })
    );
  }
}
