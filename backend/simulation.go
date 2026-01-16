package main

import (
	"fmt"
	"math/rand"
	"miner-backend/game"
	"strings"
	"time"
)

// SimulationResult holds the results of the simulation
type SimulationResult struct {
	TotalGames       int
	TotalWin         int64
	TotalBet         int64
	BombHits         int
	CashOuts         int
	AutoCollects     int
	AvgCellsRevealed float64
	RTP              float64
}

// HumanLikePlayer simulates human-like behavior
type HumanLikePlayer struct {
	rng                *rand.Rand
	riskTolerance      float64 // 0.0 (very cautious) to 1.0 (very risky)
	greedFactor        float64 // tendency to continue when winning
	maxCellsWillReveal int     // personal limit on cells to reveal
}

func NewHumanLikePlayer(seed int64) *HumanLikePlayer {
	rng := rand.New(rand.NewSource(seed))
	return &HumanLikePlayer{
		rng:                rng,
		riskTolerance:      rng.Float64(),           // Random risk tolerance
		greedFactor:        0.3 + rng.Float64()*0.4, // 0.3-0.7 greed factor
		maxCellsWillReveal: 8 + rng.Intn(12),        // Will reveal 8-19 cells max
	}
}

// shouldCashOut decides whether to cash out based on human-like factors
func (p *HumanLikePlayer) shouldCashOut(engine *game.Engine) bool {
	state := &engine.State

	// Never cash out if no wins
	if state.TotalWin <= 0 {
		return false
	}

	// Calculate some decision factors
	revealedRatio := float64(state.RevealedCount) / float64(25) // GridSize is constant 25
	netWinRatio := float64(state.NetWin) / float64(state.TotalBet)
	cellsRemaining := 25 - int(state.BombCount) - int(state.RevealedCount)

	// Base cash-out probability starts low and increases
	cashOutProb := 0.0

	// Increase cash-out probability based on cells revealed
	if state.RevealedCount >= uint8(p.maxCellsWillReveal) {
		cashOutProb += 0.8 // Very likely to cash out at personal limit
	} else if revealedRatio > 0.6 {
		cashOutProb += 0.4
	} else if revealedRatio > 0.4 {
		cashOutProb += 0.2
	}

	// Increase cash-out probability if doing well
	if netWinRatio > 2.0 {
		cashOutProb += 0.5 // Big wins make people cautious
	} else if netWinRatio > 1.0 {
		cashOutProb += 0.3
	} else if netWinRatio > 0.5 {
		cashOutProb += 0.1
	}

	// Decrease cash-out probability if global multiplier is active (greed)
	if state.GlobalStack > 1 && len(state.ActiveGlobals) > 0 {
		// People tend to push their luck with active globals
		remaining := state.ActiveGlobals[0].Remaining
		if remaining > 2 {
			cashOutProb -= 0.3 * p.greedFactor
		} else if remaining > 0 {
			cashOutProb -= 0.1 * p.greedFactor
		}
	}

	// Risk tolerance affects decision
	cashOutProb = cashOutProb * (1.0 - p.riskTolerance*0.5)

	// Few cells remaining increases caution
	if cellsRemaining <= 3 {
		cashOutProb += 0.4
	} else if cellsRemaining <= 5 {
		cashOutProb += 0.2
	}

	// Clamp probability
	if cashOutProb < 0 {
		cashOutProb = 0
	}
	if cashOutProb > 0.95 {
		cashOutProb = 0.95
	}

	return p.rng.Float64() < cashOutProb
}

// getNextCell chooses which cell to click next (human-like behavior)
func (p *HumanLikePlayer) getNextCell(engine *game.Engine) uint8 {
	state := &engine.State
	available := make([]uint8, 0, game.GridSize)

	// Find available cells
	for i, cell := range state.Cells {
		if !cell.IsOpen && !cell.IsDisabled {
			available = append(available, uint8(i))
		}
	}

	if len(available) == 0 {
		return 255 // Invalid cell ID
	}

	// Humans tend to have patterns, but with some randomness
	// 70% random choice, 30% slight preference for certain areas
	if p.rng.Float64() < 0.7 {
		// Pure random choice
		return available[p.rng.Intn(len(available))]
	} else {
		// Slight preference for corners/edges (human tendency)
		corners := []uint8{0, 4, 20, 24}
		edges := []uint8{1, 2, 3, 5, 9, 10, 14, 15, 19, 21, 22, 23}

		// Check if any preferred cells are available
		for _, corner := range corners {
			for _, avail := range available {
				if corner == avail && p.rng.Float64() < 0.3 {
					return corner
				}
			}
		}

		for _, edge := range edges {
			for _, avail := range available {
				if edge == avail && p.rng.Float64() < 0.2 {
					return edge
				}
			}
		}

		// Fallback to random
		return available[p.rng.Intn(len(available))]
	}
}

// simulateGame runs a single game with human-like behavior
func simulateGame(gameID int) (totalWin, totalBet int64, cellsRevealed int, outcome string) {
	// Create engine with large starting balance
	engine := game.NewEngine(1000000, nil, fmt.Sprintf("sim_%d", gameID))

	// Create human-like player
	player := NewHumanLikePlayer(int64(gameID))

	// Start the game
	if !engine.StartGame() {
		return 0, 0, 0, "failed_start"
	}

	// Play the game
	for engine.State.IsGameActive {
		// Decide whether to cash out (only if we have some wins)
		if engine.State.TotalWin > 0 && player.shouldCashOut(engine) {
			engine.CashOut()
			return engine.State.TotalWin, engine.State.TotalBet, int(engine.State.RevealedCount), "cash_out"
		}

		// Choose next cell to click
		cellID := player.getNextCell(engine)
		if cellID == 255 {
			// No available cells (shouldn't happen)
			break
		}

		// Click the cell
		engine.OpenCell(cellID)

		// Check if game ended (bomb or auto-collect)
		if !engine.State.IsGameActive {
			if engine.State.TotalWin == 0 {
				return 0, engine.State.TotalBet, int(engine.State.RevealedCount), "bomb"
			} else {
				return engine.State.TotalWin, engine.State.TotalBet, int(engine.State.RevealedCount), "auto_collect"
			}
		}
	}

	return engine.State.TotalWin, engine.State.TotalBet, int(engine.State.RevealedCount), "unknown"
}

func RunSimulation() {
	fmt.Println("Starting Miner Game RTP Simulation...")
	fmt.Println("Simulating 100,000,000 games with human-like behavior...")

	const totalGames = 1000000
	result := SimulationResult{
		TotalGames: totalGames,
	}

	// Track outcomes
	outcomes := make(map[string]int)
	totalCellsRevealed := 0

	startTime := time.Now()

	// Run simulation
	for i := 0; i < totalGames; i++ {
		if i > 0 && i%10000 == 0 {
			elapsed := time.Since(startTime)
			rate := float64(i) / elapsed.Seconds()
			eta := time.Duration(float64(totalGames-i)/rate) * time.Second
			fmt.Printf("Progress: %d/%d games (%.1f%%) - ETA: %v\n",
				i, totalGames, float64(i)*100/float64(totalGames), eta)
		}

		win, bet, cells, outcome := simulateGame(i)

		result.TotalWin += win
		result.TotalBet += bet
		totalCellsRevealed += cells
		outcomes[outcome]++

		// Track specific outcomes
		switch outcome {
		case "bomb":
			result.BombHits++
		case "cash_out":
			result.CashOuts++
		case "auto_collect":
			result.AutoCollects++
		}
	}

	// Calculate final statistics
	result.AvgCellsRevealed = float64(totalCellsRevealed) / float64(totalGames)
	if result.TotalBet > 0 {
		result.RTP = float64(result.TotalWin) / float64(result.TotalBet) * 100
	}

	elapsed := time.Since(startTime)

	// Print results
	fmt.Println("\n" + strings.Repeat("=", 60))
	fmt.Println("MINER GAME RTP SIMULATION RESULTS")
	fmt.Println(strings.Repeat("=", 60))
	fmt.Printf("Total Games Simulated: %d\n", result.TotalGames)
	fmt.Printf("Simulation Time: %v\n", elapsed)
	fmt.Printf("Games per Second: %.0f\n\n", float64(totalGames)/elapsed.Seconds())

	fmt.Println("FINANCIAL RESULTS:")
	fmt.Printf("Total Amount Bet: $%d\n", result.TotalBet)
	fmt.Printf("Total Amount Won: $%d\n", result.TotalWin)
	fmt.Printf("Net Result: $%d\n", result.TotalWin-result.TotalBet)
	fmt.Printf("RTP (Return to Player): %.4f%%\n\n", result.RTP)

	fmt.Println("GAME OUTCOMES:")
	fmt.Printf("Bomb Hits: %d (%.2f%%)\n", result.BombHits, float64(result.BombHits)*100/float64(totalGames))
	fmt.Printf("Cash Outs: %d (%.2f%%)\n", result.CashOuts, float64(result.CashOuts)*100/float64(totalGames))
	fmt.Printf("Auto Collects: %d (%.2f%%)\n", result.AutoCollects, float64(result.AutoCollects)*100/float64(totalGames))
	fmt.Printf("Average Cells Revealed: %.2f\n\n", result.AvgCellsRevealed)

	fmt.Println("DETAILED OUTCOMES:")
	for outcome, count := range outcomes {
		fmt.Printf("%s: %d (%.2f%%)\n", outcome, count, float64(count)*100/float64(totalGames))
	}

	fmt.Println("\nANALYSIS:")
	if result.RTP < 85 {
		fmt.Println("⚠️  Low RTP - Consider increasing multipliers or reducing bomb count")
	} else if result.RTP < 90 {
		fmt.Println("⚠️  Below average RTP - Room for improvement")
	} else if result.RTP < 95 {
		fmt.Println("✅ Acceptable RTP range")
	} else if result.RTP < 100 {
		fmt.Println("✅ Good RTP - Fair for players")
	} else {
		fmt.Println("⚠️  RTP over 100% - Unsustainable for house")
	}

	expectedBombRate := 18.0 // ~18% bomb probability
	actualBombRate := float64(result.BombHits) * 100 / float64(totalGames)
	fmt.Printf("Expected bomb rate: %.1f%%, Actual: %.2f%%\n", expectedBombRate, actualBombRate)

	avgBetPerGame := float64(result.TotalBet) / float64(totalGames)
	fmt.Printf("Average bet per game: $%.2f\n", avgBetPerGame)

	avgWinPerGame := float64(result.TotalWin) / float64(totalGames)
	fmt.Printf("Average win per game: $%.2f\n", avgWinPerGame)
}
