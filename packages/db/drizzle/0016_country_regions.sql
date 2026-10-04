ALTER TABLE "country_definitions" ADD COLUMN "continent" varchar(2);--> statement-breakpoint
ALTER TABLE "country_definitions" ADD COLUMN "merchant_market_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE country_definitions SET continent = 'AF' WHERE code IN ('AC','AO','BF','BI','BJ','BW','CD','CF','CG','CI','CM','CV','DJ','DZ','EG','EH','ER','ET','GA','GH','GM','GN','GQ','GW','KE','KM','LR','LS','LY','MA','MG','ML','MR','MU','MW','MZ','NA','NE','NG','RE','RW','SC','SD','SH','SL','SN','SO','SS','ST','SZ','TA','TD','TG','TN','TZ','UG','YT','ZA','ZM','ZW');
--> statement-breakpoint
UPDATE country_definitions SET continent = 'EU' WHERE code IN ('AD','AL','AT','AX','BA','BE','BG','BY','CH','CY','CZ','DE','DK','EE','ES','FI','FO','FR','GB','GG','GI','GR','HR','HU','IE','IM','IS','IT','JE','LI','LT','LU','LV','MC','MD','ME','MK','MT','NL','NO','PL','PT','RO','RS','SE','SI','SJ','SK','SM','UA','VA','XK');
--> statement-breakpoint
UPDATE country_definitions SET continent = 'AS' WHERE code IN ('AE','AF','AM','AZ','BD','BH','BN','BT','CC','CN','CX','GE','HK','ID','IL','IN','IO','IQ','IR','JO','JP','KG','KH','KP','KR','KW','KZ','LA','LB','LK','MM','MN','MO','MV','MY','NP','OM','PH','PK','PS','QA','RU','SA','SG','SY','TH','TJ','TM','TR','TW','UZ','VN','YE');
--> statement-breakpoint
UPDATE country_definitions SET continent = 'NA' WHERE code IN ('AG','AI','AW','BB','BL','BM','BQ','BS','BZ','CA','CR','CU','CW','DM','DO','GD','GL','GP','GT','HN','HT','JM','KN','KY','LC','MF','MQ','MS','MX','NI','PA','PM','PR','SV','SX','TC','TT','US','VC','VG','VI');
--> statement-breakpoint
UPDATE country_definitions SET continent = 'AN' WHERE code IN ('AQ','BV','GS','HM','TF');
--> statement-breakpoint
UPDATE country_definitions SET continent = 'SA' WHERE code IN ('AR','BO','BR','CL','CO','EC','FK','GF','GY','PE','PY','SR','UY','VE');
--> statement-breakpoint
UPDATE country_definitions SET continent = 'OC' WHERE code IN ('AS','AU','CK','FJ','FM','GU','KI','MH','MP','NC','NF','NR','NU','NZ','PF','PG','PN','PW','SB','TK','TL','TO','TV','UM','VU','WF','WS');
--> statement-breakpoint
UPDATE country_definitions SET merchant_market_enabled = true WHERE code IN ('AO','BF','BI','BJ','BW','CD','CF','CG','CI','CM','CV','DJ','DZ','EG','ER','ET','GA','GH','GM','GN','GQ','GW','KE','KM','LR','LS','LY','MA','MG','ML','MR','MU','MW','MZ','NA','NE','NG','RW','SC','SD','SL','SN','SO','SS','ST','SZ','TD','TG','TN','TZ','UG','ZA','ZM','ZW');
