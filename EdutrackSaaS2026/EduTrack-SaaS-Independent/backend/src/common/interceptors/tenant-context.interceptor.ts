import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext } from '../../tenants/tenant.context';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const existingTenantId = TenantContext.getTenantId();

    // If tenant context wasn't established by header middleware, but user was verified by JwtAuthGuard:
    if (!existingTenantId && req.user?.tenantId) {
      return new Observable((observer) => {
        TenantContext.run(req.user.tenantId, () => {
          next.handle().subscribe(observer);
        });
      });
    }

    return next.handle();
  }
}
