import { Injectable, NestMiddleware, BadRequestException, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantsService } from './tenants.service';
import { TenantContext } from './tenant.context';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private tenantsService: TenantsService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    let tenantSubdomain = '';

    // 1. Resolve from X-Tenant-ID header (highly reliable for SPA client REST API calls)
    const headerTenant = req.headers['x-tenant-id'] || req.headers['X-Tenant-ID'];
    if (headerTenant) {
      tenantSubdomain = String(headerTenant).trim();
    } else {
      // 2. Resolve from subdomain of hostname (e.g. school1.edutrack.com -> school1)
      const hostname = req.hostname;
      const hostParts = hostname.split('.');
      const isVercelApp = hostname.includes('vercel.app');
      const isEdutrackDomain = hostname.includes('edutrack.com');
      const isCovenTrackDomain = hostname.includes('edutrack.covenantsynergy.in') || hostname.includes('api-edutrack.covenantsynergy.in');

      if (isCovenTrackDomain) {
        if (hostParts.length > 3 && hostParts[0] !== 'www' && hostParts[0] !== 'api' && hostParts[0] !== 'api-edutrack') {
          tenantSubdomain = hostParts[0];
        }
      } else if (isEdutrackDomain) {
        if (hostParts.length > 2 && hostParts[0] !== 'www' && hostParts[0] !== 'app') {
          tenantSubdomain = hostParts[0];
        }
      } else if (isVercelApp) {
        if (hostParts.length > 3 && hostParts[0] !== 'www') {
          tenantSubdomain = hostParts[0];
        }
      } else {
        if (hostParts.length > 1 && hostParts[0] !== 'localhost' && hostParts[0] !== 'www' && isNaN(Number(hostParts[0]))) {
          tenantSubdomain = hostParts[0];
        }
      }
    }

    // 3. Fallback to query parameter (e.g. ?tenant=school1)
    if (!tenantSubdomain && req.query.tenant) {
      tenantSubdomain = String(req.query.tenant).trim();
    }

    if (!tenantSubdomain) {
      // No tenant identifier provided — allow the request through without a tenant context.
      next();
      return;
    }

    try {
      // Search by subdomain
      const tenant = await this.tenantsService.findBySubdomain(tenantSubdomain);
      TenantContext.run(tenant.id, () => {
        req['tenantId'] = tenant.id;
        next();
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        // If not found as subdomain, try if it was a raw UUID ID
        try {
          const tenant = await this.tenantsService.findById(tenantSubdomain);
          TenantContext.run(tenant.id, () => {
            req['tenantId'] = tenant.id;
            next();
          });
          return;
        } catch (e) {
          // If still not found, allow public auth routes to continue gracefully without blocking
          const isPublicAuthRoute = req.path.startsWith('/auth/') || req.path.startsWith('/tenant/public-branding');
          if (isPublicAuthRoute) {
            next();
            return;
          }
        }
      }
      const isPublicAuthRoute = req.path.startsWith('/auth/') || req.path.startsWith('/tenant/public-branding');
      if (isPublicAuthRoute) {
        next();
        return;
      }
      throw new BadRequestException(`Tenant resolution failed: ${error.message}`);
    }
  }
}
