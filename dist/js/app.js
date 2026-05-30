// INRIX World Cup Sweepstake - Single Page App

let data = null;

// Flag emojis
const flagEmojis = {
  'Argentina': '🇦🇷', 'Australia': '🇦🇺', 'Austria': '🇦🇹', 'Algeria': '🇩🇿',
  'Belgium': '🇧🇪', 'Brazil': '🇧🇷', 'Bosnia and Herzegovina': '🇧🇦',
  'Canada': '🇨🇦', 'Colombia': '🇨🇴', 'Croatia': '🇭🇷', 'Czechia': '🇨🇿', 'Curaçao': '🇨🇼',
  'DR Congo': '🇨🇩', 'Denmark': '🇩🇰',
  'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Ecuador': '🇪🇨', 'Egypt': '🇪🇬',
  'France': '🇫🇷',
  'Germany': '🇩🇪', 'Ghana': '🇬🇭',
  'Haiti': '🇭🇹',
  'Iran': '🇮🇷', 'Iraq': '🇮🇶', 'Ivory Coast': '🇨🇮', 'Italy': '🇮🇹',
  'Japan': '🇯🇵', 'Jordan': '🇯🇴',
  'Kosovo': '🇽🇰',
  'Mexico': '🇲🇽', 'Morocco': '🇲🇦',
  'Netherlands': '🇳🇱', 'New Zealand': '🇳🇿', 'Norway': '🇳🇴',
  'Panama': '🇵🇦', 'Paraguay': '🇵🇾', 'Portugal': '🇵🇹', 'Poland': '🇵🇱',
  'Qatar': '🇶🇦',
  'Saudi Arabia': '🇸🇦', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Senegal': '🇸🇳', 'South Africa': '🇿🇦', 'South Korea': '🇰🇷',
  'Spain': '🇪🇸', 'Sweden': '🇸🇪', 'Switzerland': '🇨🇭',
  'Tunisia': '🇹🇳', 'Turkey': '🇹🇷', 'Türkiye': '🇹🇷',
  'Uruguay': '🇺🇾', 'USA': '🇺🇸', 'Uzbekistan': '🇺🇿',
  'Cape Verde': '🇨🇻'
};

// Profile picture colors for initials fallback
const profileColors = ['#3498DB', '#E74C3C', '#9B59B6', '#F39C12', '#1ABC9C', 
                       '#E67E22', '#2ECC71', '#34495E', '#16A085', '#C0392B',
                       '#8E44AD', '#27AE60'];

function getColorForName(name) {
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % profileColors.length;
  return profileColors[index];
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getFirstName(name) {
  if (!name) return '';
  return name.split(' ')[0];
}

function renderProfilePic(name) {
  if (!name) return '';
  const filename = name.toLowerCase() + '.jpg';
  const initials = getInitials(name);
  const color = getColorForName(name);
  return `<img src="profiles/${filename}" class="profile-pic" alt="${name}" 
           onerror="this.outerHTML='<span class=\\'initials-circle\\' style=\\'background:${color}\\'>${initials}</span>'">`;
}

// Heat map color interpolation
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function interpolateColor(color1, color2, factor) {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  const r = Math.round(c1.r + factor * (c2.r - c1.r));
  const g = Math.round(c1.g + factor * (c2.g - c1.g));
  const b = Math.round(c1.b + factor * (c2.b - c1.b));
  return `rgb(${r},${g},${b})`;
}

function getColorForProbability(prob) {
  const stops = [
    { prob: 1.00, color: '#6DACA8' },
    { prob: 0.90, color: '#78B4A9' },
    { prob: 0.80, color: '#86BDAA' },
    { prob: 0.70, color: '#94C4AB' },
    { prob: 0.60, color: '#A1CBAC' },
    { prob: 0.50, color: '#B1D5AE' },
    { prob: 0.40, color: '#B9DBB1' },
    { prob: 0.30, color: '#CAE4B5' },
    { prob: 0.20, color: '#DCEEC1' },
    { prob: 0.10, color: '#ECF6D0' },
    { prob: 0.02, color: '#FAFDF0' },
    { prob: 0.00, color: '#FFFFFE' }
  ];
  
  for (let i = 0; i < stops.length - 1; i++) {
    if (prob >= stops[i + 1].prob) {
      const lower = stops[i + 1];
      const upper = stops[i];
      const range = upper.prob - lower.prob;
      const factor = (prob - lower.prob) / range;
      return interpolateColor(lower.color, upper.color, factor);
    }
  }
  return stops[stops.length - 1].color;
}

function getTextColorForBackground(bgColor) {
  const rgb = hexToRgb(bgColor) || { r: 255, g: 255, b: 255 };
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return brightness > 180 ? '#333' : 'white';
}

// View renderers
function renderStandings() {
  const ownerLookup = {};
  data.leaderboard.forEach(p => {
    ownerLookup[p.team1.name] = p.name;
    ownerLookup[p.team2.name] = p.name;
  });

  const teams = data.teams.map(team => ({
    ...team,
    probs: data.stage_probabilities[team.name] || {},
    owner: ownerLookup[team.name]
  })).sort((a, b) => (b.probs.win_tournament || 0) - (a.probs.win_tournament || 0));

  const rows = teams.map((team, i) => {
    const probs = team.probs;
    const flag = flagEmojis[team.name] || '🏴';
    const profilePic = renderProfilePic(team.owner);
    const topClass = i < 3 ? 'top-team' : '';
    const sectionBreak = (i === 7 || i === 15) ? 'section-break' : '';

    const renderCell = (prob, noBackground = false) => {
      const pct = ((prob || 0) * 100).toFixed(0);
      if (noBackground) {
        return `<td class="prob-cell">${pct}%</td>`;
      }
      const bgColor = getColorForProbability(prob || 0);
      const textColor = getTextColorForBackground(bgColor);
      return `<td class="prob-cell" style="background:${bgColor};color:${textColor}">${pct}%</td>`;
    };

    return `<tr class="${topClass} ${sectionBreak}">
      <td class="team-name"><span class="team-flag">${flag}</span> ${team.name}${profilePic}${team.owner ? `<span class="owner-name">${team.owner}</span>` : ''}</td>
      <td style="text-align:center;color:#7F8C8D">${team.group}</td>
      ${renderCell(probs.group_first, true)}
      ${renderCell(probs.group_second, true)}
      ${renderCell(probs.make_r16)}
      ${renderCell(probs.make_quarters)}
      ${renderCell(probs.make_semis)}
      ${renderCell(probs.make_final)}
      ${renderCell(probs.win_tournament)}
    </tr>`;
  }).join('');

  const date = new Date(data.timestamp);
  const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return `
    <div class="card">
      <div class="card-title">World Cup 2026 - Stage-by-Stage Probabilities</div>
      <div class="card-subtitle">Based on 10,000 Monte Carlo simulations • Updated ${dateStr}</div>
      <table>
        <thead>
          <tr class="header-group">
            <th rowspan="2">Team</th>
            <th rowspan="2" class="center">Group</th>
            <th colspan="2" class="center">Group Stage Finish</th>
            <th colspan="5" class="center">Knockout Stage Chances</th>
          </tr>
          <tr class="header-cols">
            <th class="center">1st Place</th>
            <th class="center">2nd Place</th>
            <th class="center">Make R16</th>
            <th class="center">Make Quarters</th>
            <th class="center">Make Semis</th>
            <th class="center">Make Final</th>
            <th class="center">Win Cup</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderMatches(matchday) {
  const matches = data.matchdays[`matchday${matchday}`] || [];
  
  // Find the "next match day" - today if there are matches, otherwise the next day with matches
  // Use US Eastern timezone to match FIFA's venue-local dates
  const todayUS = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' });
  
  // Get all unique match dates (in US timezone) and sort them
  const matchDates = [...new Set(matches.map(m => {
    const d = new Date(m.commence_time);
    return d.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
  }))].sort((a, b) => new Date(a) - new Date(b));
  
  // Find the first date that is today or in the future
  let nextMatchDate = matchDates.find(dateStr => new Date(dateStr) >= new Date(todayUS));
  // If all matches are in the past (or we're before the tournament), use the first date
  if (!nextMatchDate) nextMatchDate = matchDates[0];
  
  // Group matches by group letter
  const groups = {};
  matches.forEach(match => {
    if (!groups[match.group]) groups[match.group] = [];
    groups[match.group].push(match);
  });
  
  // Sort groups alphabetically
  const sortedGroups = Object.keys(groups).sort();
  
  // Split into left (A, C, E, G, I, K) and right (B, D, F, H, J, L) columns
  const leftGroups = sortedGroups.filter((_, i) => i % 2 === 0);
  const rightGroups = sortedGroups.filter((_, i) => i % 2 === 1);
  
  const renderMatch = (match) => {
    const homeFlag = flagEmojis[match.home_team] || '🏴';
    const awayFlag = flagEmojis[match.away_team] || '🏴';
    
    const matchDate = new Date(match.commence_time);
    // Use US Eastern timezone to match FIFA's venue-local dates
    const dateStr = matchDate.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short',
      timeZone: 'America/New_York'
    });
    // For next match comparison, also use US Eastern
    const matchDateUS = matchDate.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
    const isNextMatch = matchDateUS === nextMatchDate;

    // Handle completed match
    if (match.actual_result) {
      const homeScore = match.actual_result.home_score;
      const awayScore = match.actual_result.away_score;
      let barClass, resultText;
      
      if (homeScore > awayScore) {
        barClass = 'home-win';
        resultText = `${match.home_team} won ${homeScore}-${awayScore}`;
      } else if (awayScore > homeScore) {
        barClass = 'away-win';
        resultText = `${match.away_team} won ${awayScore}-${homeScore}`;
      } else {
        barClass = 'draw-result';
        resultText = `tie ${homeScore}-${awayScore}`;
      }

      return `
        <div class="match-row completed${isNextMatch ? ' next-match' : ''}">
          <div class="match-home">
            <span class="owner">${getFirstName(match.home_owner)}</span>
            <span class="team-name">${match.home_team}</span>
            <span class="team-flag">${homeFlag}</span>
          </div>
          <div class="match-bar">
            <div class="result-bar ${barClass}">
              <span class="result-text">${resultText}</span>
            </div>
          </div>
          <div class="match-away">
            <span class="team-flag">${awayFlag}</span>
            <span class="team-name">${match.away_team}</span>
            <span class="owner">${getFirstName(match.away_owner)}</span>
          </div>
          <span class="match-date">${dateStr}</span>
        </div>
      `;
    }

    // Upcoming match with probabilities
    const homeWin = ((match.home_win_prob || 0) * 100).toFixed(0);
    const draw = ((match.draw_prob || 0) * 100).toFixed(0);
    const awayWin = ((match.away_win_prob || 0) * 100).toFixed(0);
    const homeFav = match.home_win_prob > match.away_win_prob;
    const awayFav = match.away_win_prob > match.home_win_prob;

    return `
      <div class="match-row${isNextMatch ? ' next-match' : ''}">
        <div class="match-home">
          <span class="owner">${getFirstName(match.home_owner)}</span>
          <span class="team-name ${homeFav ? 'favorite' : ''}">${match.home_team}</span>
          <span class="team-flag">${homeFlag}</span>
        </div>
        <div class="match-bar">
          <div class="split-bar">
            <div class="home" style="width:${homeWin}%">${homeWin > 12 ? homeWin + '%' : ''}</div>
            <div class="draw" style="width:${draw}%">${draw > 12 ? draw + '%' : ''}</div>
            <div class="away" style="width:${awayWin}%">${awayWin > 12 ? awayWin + '%' : ''}</div>
          </div>
        </div>
        <div class="match-away">
          <span class="team-flag">${awayFlag}</span>
          <span class="team-name ${awayFav ? 'favorite' : ''}">${match.away_team}</span>
          <span class="owner">${getFirstName(match.away_owner)}</span>
        </div>
        <span class="match-date">${dateStr}</span>
      </div>
    `;
  };
  
  const renderColumn = (groupList) => {
    return groupList.map(groupLetter => {
      const groupMatches = groups[groupLetter] || [];
      return `
        <div class="group-section">
          <div class="group-title">GROUP ${groupLetter}</div>
          ${groupMatches.map(renderMatch).join('')}
        </div>
      `;
    }).join('');
  };

  const date = new Date(data.timestamp);
  const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return `
    <div class="card">
      <div class="card-title">Upcoming Matches - Matchday ${matchday}</div>
      <div class="card-subtitle">Updated ${dateStr} • Match odds from bookmakers</div>
      <div class="legend">
        <div class="legend-item"><div class="legend-box home"></div> Left team win</div>
        <div class="legend-item"><div class="legend-box draw"></div> Draw</div>
        <div class="legend-item"><div class="legend-box away"></div> Right team win</div>
        <div class="legend-note">Bold name = favourite</div>
      </div>
      <div class="matches-container">
        <div class="matches-column">${renderColumn(leftGroups)}</div>
        <div class="matches-column">${renderColumn(rightGroups)}</div>
      </div>
    </div>
  `;
}

function renderTimeline() {
  // Get top 8 participants
  const top8 = data.leaderboard.slice(0, 8);
  
  // 17 distinct colors for all participants (no reuse)
  const allColors = [
    '#002D72', // Navy blue
    '#E3A344', // Gold
    '#2ECC71', // Emerald green
    '#E74C3C', // Red
    '#9B59B6', // Purple
    '#1ABC9C', // Teal
    '#E67E22', // Orange
    '#3498DB', // Sky blue
    '#C0392B', // Dark red
    '#27AE60', // Forest green
    '#8E44AD', // Dark purple
    '#16A085', // Dark teal
    '#D35400', // Burnt orange
    '#2980B9', // Dark blue
    '#F1C40F', // Yellow
    '#7F8C8D', // Grey
    '#1F618D'  // Steel blue
  ];

  const datasets = top8.map((p, i) => ({
    label: p.name,
    data: data.timeline.map(t => ({
      x: new Date(t.date),
      y: (t.participants[p.name] || 0) * 100
    })),
    borderColor: allColors[i],
    backgroundColor: allColors[i],
    tension: 0.3,
    pointRadius: 3,
    pointHoverRadius: 5,
    borderWidth: 2.5,
    hoverBorderWidth: 3.5
  }));

  // Store current odds for labels
  const currentOdds = {};
  top8.forEach(p => {
    currentOdds[p.name] = (p.total_probability * 100).toFixed(1);
  });

  // Render chart after DOM update
  setTimeout(() => {
    const ctx = document.getElementById('timeline-canvas');
    if (ctx && window.Chart) {
      let activeDatasetIndex = null;
      
      const chart = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'nearest',
            axis: 'xy',
            intersect: false
          },
          scales: {
            x: {
              type: 'time',
              time: { unit: 'day' }
            },
            y: {
              title: { display: true, text: 'Win Probability (%)' },
              min: 0
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
          },
          onHover: (event, elements, chart) => {
            const newIndex = elements.length > 0 ? elements[0].datasetIndex : null;
            if (newIndex !== activeDatasetIndex) {
              activeDatasetIndex = newIndex;
              
              // Update line opacity
              chart.data.datasets.forEach((ds, i) => {
                if (activeDatasetIndex === null) {
                  ds.borderColor = allColors[i];
                  ds.backgroundColor = allColors[i];
                  ds.borderWidth = 2.5;
                } else if (i === activeDatasetIndex) {
                  ds.borderColor = allColors[i];
                  ds.backgroundColor = allColors[i];
                  ds.borderWidth = 3.5;
                } else {
                  // Desaturate - add transparency
                  ds.borderColor = allColors[i] + '30';
                  ds.backgroundColor = allColors[i] + '30';
                  ds.borderWidth = 1.5;
                }
              });
              
              chart.update('none');
              updateEndLabels(chart, activeDatasetIndex);
            }
          }
        }
      });

      // Create end labels container - covers entire chart for proper positioning
      const container = document.getElementById('timeline-chart');
      const labelsDiv = document.createElement('div');
      labelsDiv.id = 'end-labels';
      labelsDiv.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;overflow:visible;';
      container.appendChild(labelsDiv);

      function updateEndLabels(chart, activeIndex) {
        const labelsDiv = document.getElementById('end-labels');
        if (!labelsDiv) return;
        
        if (activeIndex === null) {
          labelsDiv.innerHTML = '';
          return;
        }

        const participant = top8[activeIndex];
        const meta = chart.getDatasetMeta(activeIndex);
        const lastPointMeta = meta.data[meta.data.length - 1];
        
        if (!lastPointMeta) return;
        
        const x = lastPointMeta.x;
        const y = lastPointMeta.y;
        const color = allColors[activeIndex];
        const odds = currentOdds[participant.name];
        const profileName = participant.name.toLowerCase();
        const initials = participant.name.split(' ').map(n=>n[0]).join('');

        labelsDiv.innerHTML = `
          <div style="position:absolute;left:${x + 10}px;top:${y - 18}px;display:flex;align-items:center;gap:6px;background:white;padding:4px 8px;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.15);z-index:100;white-space:nowrap;">
            <img src="profiles/${profileName}.jpg" 
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
                 style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:2px solid ${color};">
            <div style="display:none;width:28px;height:28px;border-radius:50%;background:${color};color:white;align-items:center;justify-content:center;font-size:11px;font-weight:600;">${initials}</div>
            <div style="display:flex;flex-direction:column;line-height:1.2;">
              <span style="font-size:12px;font-weight:600;color:#333;">${participant.name}</span>
              <span style="font-size:11px;color:${color};font-weight:700;">${odds}%</span>
            </div>
          </div>
        `;
      }
    }
  }, 100);

  return `
    <div class="card">
      <div class="card-title">Probability Race</div>
      <div class="card-subtitle">Top 8 participants over time • Hover lines for details</div>
      <div id="timeline-chart" style="position:relative;">
        <canvas id="timeline-canvas"></canvas>
      </div>
    </div>
  `;
}

// Router
function route() {
  const hash = window.location.hash || '#standings';
  const parts = hash.slice(1).split('/');
  const view = parts[0];
  const param = parts[1];
  
  console.log('Routing to:', view, param);
  
  // Update main nav active states
  document.querySelectorAll('.nav > .nav-tabs a').forEach(a => {
    const href = a.getAttribute('href');
    if (view === 'matches') {
      a.classList.toggle('active', href.startsWith('#matches'));
    } else {
      a.classList.toggle('active', href === '#' + view);
    }
  });
  
  // Update secondary nav active states
  document.querySelectorAll('.nav-secondary .nav-tabs a').forEach(a => {
    const href = a.getAttribute('href');
    const matchday = param || '1';
    a.classList.toggle('active', href === '#matches/' + matchday);
  });

  // Show/hide secondary nav
  const secondaryNav = document.querySelector('.nav-secondary');
  secondaryNav.classList.toggle('visible', view === 'matches');

  // Render view
  const main = document.querySelector('.main');
  
  switch (view) {
    case 'standings':
      main.innerHTML = renderStandings();
      break;
    case 'matches':
      main.innerHTML = renderMatches(parseInt(param) || 1);
      break;
    case 'timeline':
      main.innerHTML = renderTimeline();
      break;
    default:
      window.location.hash = '#standings';
  }
}

// Initialize
async function init() {
  try {
    const response = await fetch('data/latest.json', { cache: 'no-store' });
    data = await response.json();
    
    // Handle hash changes
    window.addEventListener('hashchange', route);
    
    // Handle clicks on nav links to ensure routing works
    document.querySelectorAll('.nav-tabs a').forEach(a => {
      a.addEventListener('click', (e) => {
        const href = a.getAttribute('href');
        if (href.startsWith('#')) {
          e.preventDefault();
          window.location.hash = href;
          route();
        }
      });
    });
    
    route();
  } catch (error) {
    document.querySelector('.main').innerHTML = `
      <div class="card">
        <div class="card-title">Error Loading Data</div>
        <p>${error.message}</p>
      </div>
    `;
  }
}

init();
