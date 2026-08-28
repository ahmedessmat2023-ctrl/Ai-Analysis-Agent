export interface SampleDataset {
  name: string;
  description: string;
  badge: string;
  icon: string;
  content: string;
}

export const SAMPLE_DATASETS: SampleDataset[] = [
  {
    name: 'saas_mrr_trends.csv',
    description: 'Monthly Recurring Revenue, churn, expansions, and subscriber metrics over 24 months.',
    badge: 'Time Series & Trends',
    icon: 'trending-up',
    content: `Month,New_MRR,Expansion_MRR,Churned_MRR,Net_MRR,Active_Subscribers,Avg_ARPU,Plan_Tier
2023-01,14200,3800,2100,15900,840,118.5,Pro
2023-02,15800,4200,2300,17700,910,121.0,Pro
2023-03,17100,4900,2500,19500,980,122.4,Enterprise
2023-04,18400,5300,2800,20900,1050,124.0,Enterprise
2023-05,19900,5900,2700,23100,1140,125.8,Pro
2023-06,21500,6400,3100,24800,1230,126.5,Enterprise
2023-07,22800,6900,3300,26400,1310,127.2,Starter
2023-08,24100,7400,3500,28000,1390,128.0,Enterprise
2023-09,25600,8100,3800,29900,1480,129.1,Enterprise
2023-10,27200,8700,4100,31800,1570,130.2,Pro
2023-11,28900,9300,4300,33900,1660,131.0,Enterprise
2023-12,30500,9900,4600,35800,1750,132.5,Enterprise
2024-01,32400,10600,4800,38200,1850,133.2,Enterprise
2024-02,34100,11200,5100,40200,1940,134.1,Enterprise
2024-03,36000,11900,5300,42600,2040,135.0,Enterprise
2024-04,37800,12500,5600,44700,2130,135.8,Enterprise
2024-05,39900,13200,5900,47200,2230,136.5,Enterprise
2024-06,41800,13900,6200,49500,2330,137.2,Enterprise
2024-07,43900,14600,6500,52000,2430,138.0,Enterprise
2024-08,46100,15400,6800,54700,2540,139.1,Enterprise`,
  },
  {
    name: 'ecommerce_regional_distribution.csv',
    description: 'Regional sales volumes, product categories, gross margins, and customer ratings.',
    badge: 'Distribution & Proportions',
    icon: 'pie-chart',
    content: `Region,Category,Units_Sold,Gross_Revenue,Profit_Margin,Customer_Rating,Return_Rate
North America,Electronics,12450,1867500,0.28,4.6,0.042
North America,Apparel,28300,1415000,0.44,4.3,0.081
North America,Home & Garden,15200,912000,0.36,4.4,0.035
Europe,Electronics,9800,1470000,0.26,4.5,0.039
Europe,Apparel,22400,1120000,0.42,4.2,0.075
Europe,Home & Garden,11900,714000,0.34,4.3,0.031
Asia-Pacific,Electronics,18600,2790000,0.31,4.7,0.029
Asia-Pacific,Apparel,34100,1705000,0.46,4.5,0.052
Asia-Pacific,Home & Garden,21500,1290000,0.38,4.6,0.024
Latin America,Electronics,4200,630000,0.25,4.2,0.048
Latin America,Apparel,11200,560000,0.39,4.1,0.088
Latin America,Home & Garden,6800,408000,0.32,4.0,0.041
Middle East,Electronics,3900,585000,0.30,4.4,0.033
Middle East,Apparel,8900,445000,0.41,4.3,0.062
Middle East,Home & Garden,5100,306000,0.35,4.2,0.028`,
  },
  {
    name: 'marketing_campaign_roas.csv',
    description: 'Marketing channels, ad spend, impressions, clicks, conversions, and ROAS.',
    badge: 'Correlation & Multi-Metric',
    icon: 'scatter-chart',
    content: `Channel,Ad_Spend,Impressions,Clicks,Conversions,CAC,ROAS,Conversion_Rate
Google Search,45000,850000,42500,2975,15.1,4.8,0.070
Meta Social,38000,1250000,37500,1875,20.3,3.4,0.050
YouTube Ads,29000,1600000,24000,960,30.2,2.6,0.040
LinkedIn B2B,22000,320000,12800,896,24.6,3.9,0.070
TikTok Organic+Paid,26000,1950000,48750,1462,17.8,3.1,0.030
Newsletter Sponsors,12000,180000,9000,810,14.8,4.5,0.090
Affiliate Network,18500,410000,16400,1312,14.1,4.6,0.080
Influencer Collabs,16000,720000,21600,864,18.5,3.3,0.040`,
  },
];
