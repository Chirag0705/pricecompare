I want to build a web application called **PriceCompare**.

The main purpose of the application is to help users find the best price for a product across multiple e-commerce platforms such as **Amazon, Flipkart, and Myntra**.

### Core idea

A user comes to my website and searches for a product, for example:

"iPhone 17"
"Nike Air Max shoes"
"Samsung Galaxy phone"
"Laptop"
"Headphones"

My application should search my product catalog and, where necessary, retrieve product/listing information through **authorized APIs, affiliate feeds, or other permitted integrations** from supported e-commerce platforms.

The application should identify the **same product** across different stores and compare:

- Product name
- Brand
- Model
- Product image
- Variant
- Color
- Size
- Specifications
- Current price
- Original/MRP price where available
- Discount
- Availability
- Delivery information where available
- Store
- Product URL

The user should be able to see the same product from different stores in one comparison screen.

For example:

Product: Nike Air Max 270

Amazon → ₹4,999
Flipkart → ₹4,799
Myntra → ₹5,199

The application should clearly show the available prices and allow the user to click **Buy Now** / **Go to Store**.

When the user clicks the selected store, they should be redirected to the appropriate product page on that e-commerce platform, using the appropriate permitted/affiliate link when applicable.

### MOST IMPORTANT REQUIREMENT — AUTOMATIC PRODUCT DISCOVERY

The application should not contain only manually entered products.

If Amazon, Flipkart, or Myntra adds a **new product**, my application should be able to discover that product through its authorized data integration.

The system should:

1. Periodically synchronize product data from supported stores.
2. Detect newly discovered products.
3. Check whether the product already exists in my database.
4. If it is a new product, create it in my product catalog.
5. If the product already exists, update its store listing.
6. Match the listing to the correct existing product when it is the same product.
7. Update price and availability.
8. Store price history where appropriate.
9. Make newly discovered products searchable on my website.

I want this to work as a **central product catalog + store listing aggregation + price comparison system**.

### Important architecture concept

I want my application database to be independent from the individual e-commerce websites.

For example:

ONE PRODUCT:

Nike Air Max 270

can have:

Amazon Listing
Flipkart Listing
Myntra Listing

The product and the individual store listings should be modeled separately.

The system should therefore have concepts similar to:

Product
Store
Store Listing
Price
Price History
User
Wishlist
Price Alert

### Product matching

The system should be able to determine when listings from different stores represent the same product.

Matching should preferably use reliable identifiers such as:

- Brand
- Model number
- SKU
- GTIN/EAN/UPC where available
- Product identifiers
- Variant
- Size
- Color
- Important specifications

Product names should be normalized before matching.

Do not assume that similar names automatically mean the products are identical.

### User features

Users should be able to:

- Search products
- Browse categories
- View product details
- Compare prices
- Filter results
- Sort results
- View store availability
- Visit the selected store
- Create an account
- Login/logout
- Add products to wishlist
- Remove products from wishlist
- Create price alerts
- View price history
- View their saved products
- Manage their profile

### Future/advanced features

If genuinely useful to the product, the architecture may support:

- Price history
- Price-drop notifications
- Search suggestions
- Product recommendations
- Deals
- Coupons
- Multiple product variants
- Store availability
- Price tracking
- Background synchronization
- Caching
- Job queues
- Admin monitoring

Do not add unnecessary features just to make the application larger.

### Admin

I also want an admin area where administrators can manage and monitor:

- Products
- Store listings
- Stores
- Categories
- Users
- Price data
- Product matching
- Synchronization jobs
- Failed integrations
- Data quality issues
- Price updates
- System activity

### Technology preference

I intend to use:

Frontend:
- React
- Vite
- Tailwind CSS
- Redux Toolkit
- Axios
- React Router

Backend:
- Node.js
- Express.js

Database:
- MongoDB
- Mongoose

Authentication:
- JWT

Potential future infrastructure:
- Redis
- Background jobs / queues
- Scheduled synchronization
- Notifications

### What I want from you NOW

Do NOT write code.

First, give me a clear and comprehensive **PRODUCT OVERVIEW** of this application.

Explain:

1. What the application is
2. What problem it solves
3. Who the users are
4. The complete core functionality
5. How product search works
6. How products from multiple stores are collected
7. How new products are automatically discovered
8. How the central product catalog works
9. How store listings are connected to products
10. How identical products are matched
11. How price comparison works
12. How redirection to stores works
13. How price updates work
14. How price history works
15. How wishlist and price alerts work
16. How the admin system works
17. The complete high-level system flow
18. The difference between the MVP and advanced version
19. Any important architectural decisions or problems I should solve before development

Keep the explanation understandable from an absolute beginner level but architecturally accurate.

After giving the overview, wait for me to review it.

I will ask you to modify the overview until I say it is final.

Only after I confirm that the overview is final should we proceed to the complete application architecture.