#!/usr/bin/env node

/**
 * Setup script to create initial users for Arrow Financial
 * 
 * Usage:
 *   node scripts/setup-users.js
 * 
 * This will prompt you to set passwords for admin, taylor, and dad users.
 * If users already exist, you can choose to update their passwords.
 */

require("dotenv").config();
const readline = require("readline");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../src/models/User");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function questionHidden(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    
    let input = "";
    process.stdin.on("data", function(char) {
      char = char.toString();
      
      switch (char) {
        case "\n":
        case "\r":
        case "\u0004":
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write("\n");
          resolve(input);
          break;
        case "\u0003":
          process.exit();
          break;
        case "\u007f":
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write("\b \b");
          }
          break;
        default:
          input += char;
          process.stdout.write("*");
          break;
      }
    });
  });
}

async function createOrUpdateUser(email, role, password) {
  const existing = await User.findOne({ email: email.toLowerCase() });
  
  if (existing) {
    console.log(`\nUser ${email} already exists.`);
    const update = await question("Update password? (y/n): ");
    if (update.toLowerCase() === "y") {
      const passwordHash = await bcrypt.hash(password, 10);
      existing.passwordHash = passwordHash;
      await existing.save();
      console.log(`✓ Updated password for ${email} (${role})`);
      return existing;
    } else {
      console.log(`⊘ Skipped ${email}`);
      return existing;
    }
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      role
    });
    console.log(`✓ Created user ${email} (${role})`);
    return user;
  }
}

async function main() {
  try {
    // Connect to database
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("Error: MONGODB_URI environment variable not set");
      process.exit(1);
    }
    
    console.log("Connecting to database...");
    await mongoose.connect(mongoUri);
    console.log("✓ Connected to database\n");
    
    // Define users to create
    const users = [
      { email: "admin@arrowfinancial.com", role: "admin" },
      { email: "taylor@arrowfinancial.com", role: "taylor" },
      { email: "dad@arrowfinancial.com", role: "dad" }
    ];
    
    console.log("=== Arrow Financial User Setup ===\n");
    console.log("You will be prompted to set passwords for each user.\n");
    
    for (const userInfo of users) {
      let password = "";
      let confirmPassword = "";
      
      while (true) {
        password = await questionHidden(`Enter password for ${userInfo.email} (${userInfo.role}): `);
        
        if (password.length < 6) {
          console.log("Password must be at least 6 characters. Please try again.");
          continue;
        }
        
        confirmPassword = await questionHidden("Confirm password: ");
        
        if (password !== confirmPassword) {
          console.log("Passwords do not match. Please try again.");
          continue;
        }
        
        break;
      }
      
      await createOrUpdateUser(userInfo.email, userInfo.role, password);
    }
    
    console.log("\n=== Setup Complete ===");
    console.log("\nUsers created/updated:");
    const allUsers = await User.find({}).select("-passwordHash").sort({ email: 1 });
    allUsers.forEach(user => {
      console.log(`  - ${user.email} (${user.role})`);
    });
    
  } catch (err) {
    console.error("\nError:", err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    rl.close();
  }
}

main();

