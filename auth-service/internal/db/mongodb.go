package db

import (
	"context"
	"time"

	"github.com/rs/zerolog/log"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// MongoDB holds the MongoDB client and database reference.
type MongoDB struct {
	Client   *mongo.Client
	Database *mongo.Database
}

// Connect establishes a connection to MongoDB Atlas.
func Connect(uri, dbName string) (*MongoDB, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	clientOpts := options.Client().
		ApplyURI(uri).
		SetMaxPoolSize(50).
		SetMinPoolSize(5).
		SetMaxConnIdleTime(30 * time.Second)

	client, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		return nil, err
	}

	// Verify connection
	if err := client.Ping(ctx, nil); err != nil {
		return nil, err
	}

	db := client.Database(dbName)
	log.Info().
		Str("database", dbName).
		Msg("connected to MongoDB Atlas")

	// Create indexes
	if err := createIndexes(ctx, db); err != nil {
		log.Warn().Err(err).Msg("failed to create some indexes")
	}

	return &MongoDB{Client: client, Database: db}, nil
}

// Disconnect closes the MongoDB connection.
func (m *MongoDB) Disconnect() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return m.Client.Disconnect(ctx)
}

// Collection returns a reference to a named collection.
func (m *MongoDB) Collection(name string) *mongo.Collection {
	return m.Database.Collection(name)
}

// createIndexes ensures the required indexes exist.
func createIndexes(ctx context.Context, db *mongo.Database) error {
	// Users: unique username index
	_, err := db.Collection("users").Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "username", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	if err != nil {
		return err
	}

	// Users: unique email index
	_, err = db.Collection("users").Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "email", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	if err != nil {
		return err
	}

	// Devices: compound index on user_id + fingerprint
	_, err = db.Collection("devices").Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{
			{Key: "user_id", Value: 1},
			{Key: "fingerprint_hash", Value: 1},
		},
	})
	if err != nil {
		return err
	}

	// AccessLogs: index on user_id + created_at for time-series queries
	_, err = db.Collection("access_logs").Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{
			{Key: "user_id", Value: 1},
			{Key: "created_at", Value: -1},
		},
	})
	if err != nil {
		return err
	}

	// AccessLogs: TTL index — auto-delete logs older than 90 days
	_, err = db.Collection("access_logs").Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "created_at", Value: 1}},
		Options: options.Index().SetExpireAfterSeconds(90 * 24 * 60 * 60),
	})
	if err != nil {
		return err
	}

	// BaselineProfiles: unique user_id index
	_, err = db.Collection("baseline_profiles").Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "user_id", Value: 1}},
		Options: options.Index().SetUnique(true),
	})

	log.Info().Msg("MongoDB indexes created/verified")
	return err
}
