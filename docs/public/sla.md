# Service Level Agreement (SLA)

This Service Level Agreement (SLA) describes the service commitments Nuclom provides to its customers.

## Overview

Nuclom is committed to maintaining high availability and reliability for our video collaboration platform. This SLA outlines our uptime commitments, response time guarantees, and remediation procedures.

---

## Uptime Guarantees

### Monthly Uptime Commitment

| Plan | Uptime SLA | Maximum Downtime per Month |
|------|------------|---------------------------|
| **Pro** | 99.5% | 3 hours 39 minutes |
| **Enterprise** | 99.9% | 43 minutes |

### What Counts as Downtime

Downtime is defined as:
- Complete inability to access the Nuclom platform
- Inability to upload or view videos
- API endpoints returning 5xx errors consistently for more than 5 minutes

### What Does NOT Count as Downtime

The following are excluded from SLA calculations:
- Scheduled maintenance (announced 48+ hours in advance)
- Emergency security patches
- Issues caused by customer-side network problems
- Third-party service outages outside our control
- Features in beta or preview status
- Force majeure events

---

## Service Credits

If we fail to meet our uptime commitment, you are eligible for service credits applied to your next billing cycle.

### Credit Calculation

| Monthly Uptime | Service Credit (% of Monthly Fee) |
|----------------|----------------------------------|
| 99.0% - 99.49% | 10% |
| 95.0% - 98.99% | 25% |
| 90.0% - 94.99% | 50% |
| Below 90% | 100% |

### How to Request Credits

1. Submit a support request within 30 days of the incident
2. Include the date(s) and time(s) of the outage
3. Describe the impact on your operations
4. Credits will be applied within 2 billing cycles

### Credit Limitations

- Maximum credit per month: 100% of monthly fee
- Credits do not apply to free trial periods
- Credits are not transferable or refundable as cash
- Annual plans: credits calculated on equivalent monthly value

---

## Support Response Times

### Support Tiers by Plan

| Priority | Description | Pro Response | Enterprise Response |
|----------|-------------|--------------|---------------------|
| **P1 - Critical** | Service completely down | 4 hours | 1 hour |
| **P2 - High** | Major feature unavailable | 8 hours | 2 hours |
| **P3 - Medium** | Feature degraded | 24 hours | 4 hours |
| **P4 - Low** | General questions | 48 hours | 8 hours |

### Priority Definitions

**P1 - Critical**
- Complete platform outage affecting all users
- Data loss or security breach
- All API endpoints returning errors

**P2 - High**
- Major feature completely non-functional
- Video uploads failing for all users
- Authentication system down

**P3 - Medium**
- Feature partially working with degraded performance
- Slow video playback
- Delayed transcription processing

**P4 - Low**
- General questions about features
- Feature requests
- Documentation inquiries

---

## Support Channels

### Pro Plan

- **Email Support**: support@nuclom.com
- **Help Documentation**: Full access to guides and API docs
- **Response Hours**: Monday-Friday, 9am-6pm EST

### Enterprise Plan

- **Priority Email & Chat Support**: Dedicated support channel
- **Dedicated Account Manager**: Named contact for your organization
- **Phone Support**: Available for P1/P2 issues
- **Response Hours**: 24/7 for P1 issues, business hours for others
- **Custom Onboarding**: Personalized setup and training sessions
- **Quarterly Business Reviews**: Strategic planning sessions

---

## Maintenance Windows

### Scheduled Maintenance

- **Primary Window**: Sundays, 2am-6am EST
- **Backup Window**: Wednesdays, 2am-4am EST
- **Advance Notice**: Minimum 48 hours for standard maintenance
- **Emergency Maintenance**: Minimum 2 hours notice for security patches

### Maintenance Communication

- All scheduled maintenance announced via:
  - Email to organization administrators
  - In-app notification banner
  - Status page at status.nuclom.com

---

## Performance Benchmarks

### Target Performance Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Video Load Time | < 3 seconds | Time to first frame |
| API Response Time | < 200ms | p95 latency |
| Upload Speed | > 10 MB/s | Sustained throughput |
| Transcription Processing | < 10 minutes | For videos under 1 hour |
| Search Results | < 500ms | Query to results displayed |

### Performance Monitoring

- Real-time monitoring of all systems
- Automated alerting for performance degradation
- Monthly performance reports for Enterprise customers
- Public status page with real-time metrics

---

## Data Protection

### Backup and Recovery

| Aspect | Commitment |
|--------|------------|
| **Database Backups** | Every 6 hours |
| **Point-in-Time Recovery** | Up to 7 days |
| **Geo-Redundancy** | Multi-region storage |
| **Recovery Time Objective** | < 4 hours |
| **Recovery Point Objective** | < 1 hour |

### Data Retention

- Active account data: Retained indefinitely
- Deleted videos: 30-day recovery period
- Account deletion: Data removed within 30 days
- Audit logs (Enterprise): 1 year retention

---

## Security Commitments

### Compliance & Certifications

- SOC 2 Type II (in progress)
- GDPR compliant
- CCPA compliant
- Encryption at rest and in transit

### Security Response

| Severity | Response Time | Resolution Target |
|----------|--------------|-------------------|
| Critical | 1 hour | 24 hours |
| High | 4 hours | 72 hours |
| Medium | 24 hours | 7 days |
| Low | 48 hours | 30 days |

---

## SLA Exclusions

This SLA does not apply to:

1. **Beta Features**: Features marked as "beta" or "preview"
2. **Free Trials**: 14-day trial periods
3. **Custom Integrations**: Customer-built integrations via API
4. **Third-Party Services**: External services like Zoom, Google Meet
5. **Abuse**: Service disruption caused by violation of Terms of Service
6. **Customer Actions**: Issues caused by customer configurations

---

## Contact Information

### Support

- **Email**: support@nuclom.com
- **Help Center**: help.nuclom.com
- **Status Page**: status.nuclom.com

### Enterprise Support

- **Dedicated Line**: Contact your account manager
- **Emergency Escalation**: escalation@nuclom.com

---

## SLA Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | January 2026 | Initial SLA publication |

---

*This SLA is subject to the terms of your subscription agreement. In case of conflict, the subscription agreement takes precedence.*

*Last Updated: January 2026*
