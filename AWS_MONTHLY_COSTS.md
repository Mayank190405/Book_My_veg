
# AWS Monthly Cost Estimation: BookMyVeg
**Scale**: ~100 Orders/Day | ~250 Billing Events/Day

For this volume, your application is considered **Low to Medium Traffic**. You can comfortably run this on the smallest production-grade instances.

---

## 1. Scenario A: AWS Free Tier (First 12 Months)
If your account is new, AWS provides a "Free Tier" that covers almost 100% of these requirements.

| Service | Component | Monthly Cost (Free Tier) |
| :--- | :--- | :--- |
| **EC2** | 1x `t2.micro` or `t3.micro` (750 hrs/mo) | **$0.00** |
| **RDS (DB)** | 1x `db.t3.micro` Postgres (750 hrs/mo + 20GB) | **$0.00** |
| **ECR** | Storage for Docker Images (< 500MB) | **$0.00** (minimal) |
| **EBS** | 30GB General Purpose SSD | **$0.00** |
| **Data Transfer** | Outbound data (Receipts/Browsing) | **$0.00** (under 100GB limit) |
| **TOTAL** | | **$0.00 / month** |

---

## 2. Scenario B: Post-Free Tier (Standard Monthly Cost)
Once the 12-month Free Tier expires, these are the estimated retail costs (on-demand).

### Recommendation 1: "All-in-One" EC2 (Cheapest)
*Running Postgres, Redis, and Apps on a single `t3.small` instance.*
- **EC2 (`t3.small` - 2GB RAM)**: ~$15.00
- **EBS Storage (20GB)**: ~$2.00
- **Total: ~$17.00 / Month**

### Recommendation 2: "Production Standard" (Recommended for 100 orders/day)
*Decoupled Database (RDS) from App Server for zero data loss risk.*
- **EC2 (`t3.micro` - 1GB RAM for Apps)**: ~$7.50
- **RDS (`db.t3.micro` - 1GB RAM for DB)**: ~$13.00
- **EBS Storage (20GB)**: ~$2.00
- **Total: ~$22.50 / Month**

---

## 3. Operational Utilization (100 Orders/Day)
- **CPU Usage**: Average < 5%. 250 bills/day means 1 transaction roughly every 2-3 minutes during peak hours. `t3.micro` burstable CPU is more than enough.
- **Memory**: The biggest constraint. Next.js (Client) + Node (Server) will use ~600MB. Postgres will use ~200MB. This is why a `t3.micro` (1GB) is tight but okay with the **Swap File** I included in the deployment guide.
- **Storage**: 250 bills/day generate very little data (~10MB of text logs/records per month). 20GB storage will last you years.

---

## 4. Cost-Saving Tips
1. **Reserved Instances (RI)**: If you commit to 1 year, the cost drops by ~30-40% (Total: ~$15/mo).
2. **AWS Graviton (`t4g`)**: Use `t4g.micro` instead of `t3.micro`. It is ~20% cheaper and faster. (Current configuration works on both).
3. **External Images**: Keep using **Cloudinary** or **Unsplash** for product images so you don't pay for EBS storage or high-bandwidth transfer.

---

**Summary**: For a 100 order/day scale, your monthly AWS expense will be **$0** for the first year and approximately **$22 (approx. ₹1,800)** thereafter.
