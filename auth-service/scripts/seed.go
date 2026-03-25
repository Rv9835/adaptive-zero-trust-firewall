// Seed script for development — creates test users in MongoDB.
// Run: go run scripts/seed.go
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	uri := os.Getenv("MONGODB_URI")
	if uri == "" {
		uri = "mongodb://localhost:27017"
	}
	dbName := os.Getenv("MONGODB_DATABASE")
	if dbName == "" {
		dbName = "ztna-firewall"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		panic(err)
	}
	defer client.Disconnect(ctx)

	db := client.Database(dbName)
	usersCol := db.Collection("users")
	devicesCol := db.Collection("devices")

	// Create test users
	users := []struct {
		username string
		email    string
		password string
		role     string
	}{
		{"sarah.engineer", "sarah@company.com", "SecurePass123!", "engineer"},
		{"raj.sales", "raj@company.com", "SecurePass456!", "sales"},
		{"admin", "admin@company.com", "AdminPass789!", "admin"},
	}

	for _, u := range users {
		hash, _ := bcrypt.GenerateFromPassword([]byte(u.password), bcrypt.DefaultCost)
		now := time.Now()

		result, err := usersCol.InsertOne(ctx, bson.M{
			"username":      u.username,
			"email":         u.email,
			"password_hash": string(hash),
			"role":          u.role,
			"mfa_secret":    "",
			"mfa_enabled":   false,
			"is_locked":     false,
			"failed_logins": 0,
			"created_at":    now,
			"updated_at":    now,
		})
		if err != nil {
			fmt.Printf("⚠ User %s may already exist: %v\n", u.username, err)
			continue
		}

		userID := result.InsertedID.(primitive.ObjectID)
		fmt.Printf("✓ Created user: %s (ID: %s) password: %s\n", u.username, userID.Hex(), u.password)

		// Add a trusted device for each user
		devicesCol.InsertOne(ctx, bson.M{
			"user_id":          userID,
			"fingerprint_hash": fmt.Sprintf("dev-%s-laptop", u.username),
			"device_name":      fmt.Sprintf("%s's Laptop", u.username),
			"device_type":      "desktop",
			"last_known_ip":    "10.0.1.50",
			"is_trusted":       true,
			"last_seen":        now,
			"created_at":       now,
		})
	}

	fmt.Println("\n✓ Seed data inserted successfully!")
	fmt.Println("\nTest credentials:")
	fmt.Println("  sarah.engineer / SecurePass123!")
	fmt.Println("  raj.sales      / SecurePass456!")
	fmt.Println("  admin          / AdminPass789!")
}
