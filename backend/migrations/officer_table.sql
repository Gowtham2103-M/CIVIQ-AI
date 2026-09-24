officer_id	int	NO	PRI		auto_increment
full_name	varchar(100)	NO			
email	varchar(150)	NO	UNI		
password_hash	varchar(255)	YES			
phone	varchar(20)	YES			
address	text	YES			
city	varchar(100)	YES			
district	varchar(100)	YES			
state	varchar(100)	YES			
pincode	varchar(10)	YES			
department	varchar(100)	NO	MUL		
designation	varchar(100)	YES			
employee_code	varchar(50)	YES			
status	enum('ACTIVE','INACTIVE','ON_LEAVE')	NO	MUL	ACTIVE	
last_login	datetime	YES			
created_at	timestamp	YES		CURRENT_TIMESTAMP	DEFAULT_GENERATED
updated_at	timestamp	YES		CURRENT_TIMESTAMP	DEFAULT_GENERATED on update CURRENT_TIMESTAMP